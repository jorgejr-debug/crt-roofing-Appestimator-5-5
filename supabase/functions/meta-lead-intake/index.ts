import { createClient } from "npm:@supabase/supabase-js@2";
import { validSignature, leadEvents, mapMetaLead } from "../_shared/meta-leads.js";

const reply = (status: number, message: string) => new Response(message, { status });
Deno.serve(async request => {
  const env = (name: string) => Deno.env.get(name) || "";
  const url = new URL(request.url);
  if (request.method === "GET") {
    return env("META_VERIFY_TOKEN") && url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === env("META_VERIFY_TOKEN")
      ? reply(200, url.searchParams.get("hub.challenge") || "") : reply(403, "Verification failed");
  }
  if (request.method !== "POST") return reply(405, "Method not allowed");
  const required = ["META_APP_SECRET", "META_PAGE_ID", "META_FORM_ID", "META_PAGE_ACCESS_TOKEN", "META_GRAPH_VERSION",
    "META_INTAKE_OWNER_ID", "META_PROPERTY_FIELD", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY",
    "META_NOTIFICATION_FROM_EMAIL", "META_APP_URL"];
  if (required.some(key => !env(key))) return reply(503, "Integration not configured");
  const raw = await request.text();
  if (raw.length > 1000000) return reply(413, "Payload too large");
  if (!await validSignature(raw, request.headers.get("x-hub-signature-256"), env("META_APP_SECRET"))) return reply(401, "Invalid signature");
  let payload;
  try { payload = JSON.parse(raw); } catch { return reply(400, "Invalid JSON"); }
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  try {
    const events = leadEvents(payload, env("META_PAGE_ID"), env("META_FORM_ID"));
    for (const event of events) {
      const id = String(event.leadgen_id);
      const endpoint = new URL(`https://graph.facebook.com/${env("META_GRAPH_VERSION")}/${id}`);
      endpoint.searchParams.set("fields", "id,created_time,form_id,ad_id,field_data");
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${env("META_PAGE_ACCESS_TOKEN")}` }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Lead retrieval failed");
      const lead = await response.json();
      if (String(lead.id) !== id || String(lead.form_id) !== env("META_FORM_ID")) throw new Error("Lead identity mismatch");
      const mapped = mapMetaLead(lead, env("META_PROPERTY_FIELD"));
      const { error } = await db.rpc("ingest_meta_lead", {
        p_meta_id: id, p_owner: env("META_INTAKE_OWNER_ID"), p_fields: mapped,
        p_metadata: { page_id: env("META_PAGE_ID"), form_id: lead.form_id, ad_id: lead.ad_id || event.ad_id || null, created_time: lead.created_time, field_data: lead.field_data },
      });
      if (error) throw new Error("Lead persistence failed");
      const receipt = await db.from("meta_lead_receipts").select("notified_at").eq("meta_lead_id", id).single();
      if (receipt.error) throw new Error("Receipt lookup failed");
      if (receipt.data.notified_at) continue;
      const owner = await db.from("user_profiles").select("email").eq("id", env("META_INTAKE_OWNER_ID")).single();
      if (owner.error || !owner.data.email) throw new Error("Owner lookup failed");
      const mail = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json", "Idempotency-Key": `meta-lead-${id}` },
        body: JSON.stringify({ from: env("META_NOTIFICATION_FROM_EMAIL"), to: [owner.data.email],
          subject: "New Meta lead — review in CRT",
          text: `A new Meta inquiry is ready for your review in the CRT app.\n${env("META_APP_URL")}\nOpen CRM and filter Source to Meta Ads. Qualify the request before sending it to Ivan.\nReference: ${id}` }),
      });
      if (!mail.ok) throw new Error("Notification delivery failed");
      const saved = await db.from("meta_lead_receipts").update({ notified_at: new Date().toISOString() }).eq("meta_lead_id", id);
      if (saved.error) throw new Error("Notification receipt failed");
    }
    return reply(200, "EVENT_RECEIVED");
  } catch {
    // No contact information or access tokens in logs; non-2xx allows Meta to retry.
    console.error("Meta intake failed; check configuration, API access and receipt state.");
    return reply(503, "Intake failed; retry required");
  }
});
