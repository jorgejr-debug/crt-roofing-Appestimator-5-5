import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeSignature(dataUrl: string) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match) throw new Error("A PNG or JPEG signature is required");
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  if (bytes.length < 100 || bytes.length > 2_000_000) throw new Error("Signature file size is invalid");
  return { bytes, extension: match[1] === "jpeg" ? "jpg" : "png", contentType: `image/${match[1]}` };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  const kind = String(url.searchParams.get("kind") || "proposal").trim();
  if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "Signing link is invalid" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Signing service is not configured" }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const tokenHash = await sha256(token);

  if (kind === "change-order") {
    const { data: session } = await admin.from("proposal_change_order_signing_sessions").select("id, change_order_id, expires_at, used_at").eq("token_hash", tokenHash).maybeSingle();
    if (!session || session.used_at || new Date(session.expires_at) <= new Date()) return json({ error: "Signing link is invalid or expired" }, 410);
    const { data: changeOrder } = await admin.from("proposal_change_orders").select("id, description, scope, price, status").eq("id", session.change_order_id).single();
    if (request.method === "GET") return json({ kind, changeOrder });
    const body = await request.json();
    const customerName = String(body.customerName || "").trim();
    if (!customerName) return json({ error: "Customer name is required" }, 400);
    const signature = decodeSignature(String(body.signatureDataUrl || ""));
    const storagePath = `executed/change-orders/${session.change_order_id}/${crypto.randomUUID()}.${signature.extension}`;
    const upload = await admin.storage.from("proposal-request-files").upload(storagePath, signature.bytes, { contentType: signature.contentType, upsert: false });
    if (upload.error) return json({ error: upload.error.message }, 500);
    const result = await admin.rpc("complete_customer_change_order_signature", { p_raw_token: token, p_customer_name: customerName, p_signature_path: storagePath });
    if (result.error) return json({ error: result.error.message }, 422);
    return json({ ok: true, proposalRequestId: result.data });
  }

  const { data: session } = await admin.from("proposal_signing_sessions").select("id, proposal_version_id, expires_at, used_at").eq("token_hash", tokenHash).maybeSingle();
  if (!session || session.used_at || new Date(session.expires_at) <= new Date()) return json({ error: "Signing link is invalid or expired" }, 410);
  const { data: version } = await admin.from("proposal_versions").select("id, version_number, sections, customer_decision, proposal_request_id").eq("id", session.proposal_version_id).single();
  const { data: proposalRequest } = await admin.from("proposal_requests").select("request_number, customer_name, property_name, service_address").eq("id", version?.proposal_request_id).single();
  if (!version || !proposalRequest) return json({ error: "Proposal could not be loaded" }, 404);
  if (request.method === "GET") {
    await admin.from("proposal_versions").update({ viewed_at: new Date().toISOString() }).eq("id", version.id).is("viewed_at", null);
    return json({ kind: "proposal", proposalRequest, version: { id: version.id, versionNumber: version.version_number, sections: version.sections } });
  }

  const body = await request.json();
  const decision = String(body.decision || "");
  const customerName = String(body.customerName || "").trim();
  const approvedSectionIds = Array.isArray(body.approvedSectionIds) ? body.approvedSectionIds.map(String) : [];
  let storagePath = "";
  if (decision === "signed") {
    if (!customerName || !approvedSectionIds.length) return json({ error: "Customer name and at least one approved section are required" }, 400);
    const signature = decodeSignature(String(body.signatureDataUrl || ""));
    storagePath = `executed/proposals/${version.id}/${crypto.randomUUID()}.${signature.extension}`;
    const upload = await admin.storage.from("proposal-request-files").upload(storagePath, signature.bytes, { contentType: signature.contentType, upsert: false });
    if (upload.error) return json({ error: upload.error.message }, 500);
  }
  const result = await admin.rpc("complete_customer_proposal_decision", {
    p_raw_token: token,
    p_decision: decision,
    p_customer_name: customerName,
    p_signature_path: storagePath,
    p_approved_section_ids: approvedSectionIds,
  });
  if (result.error) return json({ error: result.error.message }, 422);
  return json({ ok: true, proposalRequestId: result.data });
});
