import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const allowedRoles = new Set(["salesperson", "estimator", "admin", "cfo"]);
const fieldKeys = [
  "customer_name", "property_name", "service_address", "project_contact_first_name", "project_contact_last_name",
  "project_contact_phone", "project_contact_email", "customer_requests", "property_type", "story_count",
  "construction_type", "roofing_system", "roof_areas", "work_type", "measurements", "roof_measurement_notes",
  "existing_layers", "scope_of_work", "material_specifications", "special_conditions", "roof_access_details",
  "equipment_requirements", "hvac_requirements", "subcontractor_requirements", "permit_requirements",
  "overspray_risk_notes", "exclusions", "alternates", "verbal_commitments", "customer_deadline",
  "estimated_crew_size", "estimated_working_days",
];

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "fields", "missing_critical", "needs_confirmation"],
  properties: {
    summary: { type: "string" },
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "value", "evidence", "confidence"],
        properties: {
          key: { type: "string", enum: fieldKeys },
          value: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    missing_critical: { type: "array", items: { type: "string" } },
    needs_confirmation: { type: "array", items: { type: "string" } },
  },
};

function responseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) if (typeof part?.text === "string") return part.text;
  }
  return "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!supabaseUrl || !anonKey) return json({ error: "Inspection extraction service is not configured" }, 500);
    if (!openaiKey) return json({ error: "Inspection AI is not configured. Add the OPENAI_API_KEY secret before using this feature." }, 503);
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const caller = createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userError } = await caller.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);
    const { data: profile } = await caller.from("user_profiles").select("id,email,role").eq("id", userData.user.id).single();
    if (!profile || !allowedRoles.has(String(profile.role || "").toLowerCase())) return json({ error: "Sales, estimating, or management access required" }, 403);

    const body = await request.json();
    const transcript = String(body.transcript || "").trim();
    if (transcript.length < 40) return json({ error: "Paste a longer PLAUD summary or transcript before organizing it" }, 422);
    if (transcript.length > 100_000) return json({ error: "The transcript is too long. Upload a PLAUD summary or a transcript under 100,000 characters." }, 413);
    const supplied = body.context && typeof body.context === "object" ? body.context : {};
    const context = {
      customer_name: String(supplied.customer_name || ""),
      property_name: String(supplied.property_name || ""),
      service_address: String(supplied.service_address || ""),
      project_contact_first_name: String(supplied.project_contact_first_name || ""),
      project_contact_last_name: String(supplied.project_contact_last_name || ""),
      project_contact_phone: String(supplied.project_contact_phone || ""),
      project_contact_email: String(supplied.project_contact_email || ""),
    };
    const instructions = `You organize CRT Roofing field inspection notes into a proposal-request handoff. Extract only facts explicitly stated in the transcript or supplied existing context. Never infer, calculate, or invent measurements, roof layers, materials, scope, customer promises, dates, crew sizes, or specifications. Omit unsupported fields. Evidence must be a brief exact or near-exact phrase from the source. Use high confidence only for unambiguous facts, medium for clearly stated but approximate facts, and low for ambiguous facts. customer_deadline must be YYYY-MM-DD only when explicitly known. Numeric fields must contain only the stated number. Critical fields are customer_name, service_address, scope_of_work, and measurements. Put any absent critical field in missing_critical. Put ambiguous, approximate, conflicting, or low-confidence facts in needs_confirmation. The summary should be a concise estimator intake summary and must not add facts.`;
    const userInput = `EXISTING JOB CONTEXT (trusted only where non-empty):\n${JSON.stringify(context)}\n\nPLAUD SUMMARY OR TRANSCRIPT:\n${transcript}`;
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_INSPECTION_MODEL") || "gpt-5-mini",
        store: false,
        input: [
          { role: "system", content: [{ type: "input_text", text: instructions }] },
          { role: "user", content: [{ type: "input_text", text: userInput }] },
        ],
        text: { format: { type: "json_schema", name: "crt_inspection_handoff", strict: true, schema } },
      }),
    });
    if (!aiResponse.ok) {
      const detail = (await aiResponse.text()).slice(0, 1000);
      console.error("Inspection extraction failed", aiResponse.status, detail);
      return json({ error: "The inspection could not be organized. Please try again or continue with the manual handoff." }, 502);
    }
    const responsePayload = await aiResponse.json();
    const raw = responseText(responsePayload);
    if (!raw) return json({ error: "The inspection organizer returned no usable information" }, 502);
    return json({ extraction: JSON.parse(raw), model: responsePayload.model || "configured-model" });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Inspection extraction failed" }, 500);
  }
});
