import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const APPROVER_EMAILS = ["jorgejr@crtroofing.com", "natalia@crtroofing.com"];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const escapeHtml = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function encryptionKey() {
  const secret = Deno.env.get("ACCOUNT_VAULT_ENCRYPTION_KEY");
  if (!secret || secret.length < 32) throw new Error("Account vault encryption is not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptSecret(secret: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(secret));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), plaintext);
  return { encrypted_secret: base64(new Uint8Array(encrypted)), encryption_iv: base64(iv) };
}

async function decryptSecret(ciphertext: string, iv: string) {
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await encryptionKey(), fromBase64(ciphertext));
  return JSON.parse(new TextDecoder().decode(decrypted));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Account access service is not configured" }, 500);
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const caller = createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userError } = await caller.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await admin.from("user_profiles").select("id,full_name,email,role").eq("id", userData.user.id).single();
    if (!profile) return json({ error: "User profile not found" }, 403);
    const email = String(profile.email || "").toLowerCase();
    const isApprover = APPROVER_EMAILS.includes(email);
    const { action, ...body } = await request.json();
    const now = new Date();
    const nowIso = now.toISOString();

    const audit = async (values: Record<string, unknown>) => {
      await admin.from("credential_access_audit_log").insert({ actor_id: profile.id, requester_id: profile.id, ...values });
    };
    const notifyApprovers = async (subject: string, message: string) => {
      const apiKey = Deno.env.get("RESEND_API_KEY");
      const from = Deno.env.get("ACCOUNT_ACCESS_FROM_EMAIL") || Deno.env.get("TASK_NOTIFICATION_FROM_EMAIL");
      if (!apiKey || !from) throw new Error("Account access email delivery is not configured");
      const recipients = APPROVER_EMAILS.filter((address) => address !== email);
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: recipients, reply_to: "accounting@crtroofing.com", subject, html: `<div style="font-family:Arial,sans-serif;color:#102536;line-height:1.5"><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(message)}</p><p>Open CRT Roofing → Account Access to approve or deny this request.</p></div>` }) });
      if (!response.ok) throw new Error("Approval email could not be sent");
    };

    await admin.from("credential_access_requests").update({ status: "expired", updated_at: nowIso }).eq("status", "approved").lt("expires_at", nowIso);

    if (action === "status") {
      const { data: requests } = await admin.from("credential_access_requests").select("*").eq("requester_id", profile.id).order("created_at", { ascending: false });
      const catalog = (requests || []).find((item) => item.request_type === "catalog" && item.status === "approved" && item.expires_at > nowIso) || null;
      const { data: entries } = catalog ? await admin.from("credential_vault_entries").select("id,website_name,website_url,category,created_at,updated_at").eq("is_active", true).order("website_name") : { data: [] };
      let approvals: unknown[] = [];
      if (isApprover) {
        const { data } = await admin.from("credential_access_requests").select("*, requester:user_profiles!credential_access_requests_requester_id_fkey(full_name,email), entry:credential_vault_entries(website_name)").eq("status", "pending").neq("requester_id", profile.id).order("created_at");
        approvals = data || [];
      }
      const { data: managedEntries } = isApprover ? await admin.from("credential_vault_entries").select("id,website_name,website_url,category,is_active,created_at,updated_at").order("website_name") : { data: [] };
      return json({ profile: { id: profile.id, name: profile.full_name, email, isApprover }, catalogRequest: (requests || []).find((item) => item.request_type === "catalog") || null, catalog, itemRequests: (requests || []).filter((item) => item.request_type === "item"), entries: entries || [], approvals, managedEntries: managedEntries || [] });
    }

    if (action === "request_catalog") {
      const reason = String(body.reason || "").trim();
      if (reason.length < 5) return json({ error: "Please explain why access is needed" }, 422);
      const { data: existing } = await admin.from("credential_access_requests").select("id").eq("requester_id", profile.id).eq("request_type", "catalog").in("status", ["pending", "approved"]).gte("expires_at", nowIso).maybeSingle();
      if (existing) return json({ error: "You already have an active or pending catalog request" }, 409);
      const { data: created, error } = await admin.from("credential_access_requests").insert({ requester_id: profile.id, request_type: "catalog", reason, expires_at: new Date(now.getTime() + 24 * 60 * 60_000).toISOString() }).select().single();
      if (error) throw error;
      await audit({ request_id: created.id, action: "catalog_access_requested", details: { reason } });
      await notifyApprovers(`Account catalog access requested by ${profile.full_name || email}`, `${profile.full_name || email} requested access to browse the CRT account catalog. Reason: ${reason}`);
      return json({ ok: true });
    }

    if (action === "request_item") {
      const reason = String(body.reason || "").trim();
      const entryId = String(body.entryId || "");
      const { data: catalog } = await admin.from("credential_access_requests").select("id").eq("requester_id", profile.id).eq("request_type", "catalog").eq("status", "approved").gt("expires_at", nowIso).order("approved_at", { ascending: false }).limit(1).maybeSingle();
      if (!catalog) return json({ error: "Catalog approval is required first" }, 403);
      const { data: entry } = await admin.from("credential_vault_entries").select("id,website_name").eq("id", entryId).eq("is_active", true).single();
      if (!entry) return json({ error: "Account not found" }, 404);
      if (reason.length < 5) return json({ error: "Please explain why this account is needed" }, 422);
      const { data: created, error } = await admin.from("credential_access_requests").insert({ requester_id: profile.id, request_type: "item", catalog_request_id: catalog.id, vault_entry_id: entry.id, reason, expires_at: new Date(now.getTime() + 24 * 60 * 60_000).toISOString() }).select().single();
      if (error) throw error;
      await audit({ request_id: created.id, vault_entry_id: entry.id, action: "account_access_requested", details: { reason, website_name: entry.website_name } });
      await notifyApprovers(`Account access requested: ${entry.website_name}`, `${profile.full_name || email} requested the login for ${entry.website_name}. Reason: ${reason}`);
      return json({ ok: true });
    }

    if (action === "decide") {
      if (!isApprover) return json({ error: "Only Jorge or Natalia can approve account access" }, 403);
      const decision = body.decision === "approved" ? "approved" : body.decision === "denied" ? "denied" : "";
      if (!decision) return json({ error: "Invalid decision" }, 422);
      const { data: pending } = await admin.from("credential_access_requests").select("*").eq("id", body.requestId).eq("status", "pending").neq("requester_id", profile.id).single();
      if (!pending) return json({ error: "Pending request not found or self-approval is not allowed" }, 404);
      if (pending.request_type === "item") {
        const { data: activeCatalog } = await admin.from("credential_access_requests").select("id").eq("id", pending.catalog_request_id).eq("status", "approved").gt("expires_at", nowIso).maybeSingle();
        if (!activeCatalog) return json({ error: "The requester's catalog approval expired; a new first-stage approval is required" }, 409);
      }
      const minutes = pending.request_type === "catalog" ? 30 : 5;
      const { error } = await admin.from("credential_access_requests").update({ status: decision, approved_by: profile.id, approved_at: nowIso, expires_at: decision === "approved" ? new Date(now.getTime() + minutes * 60_000).toISOString() : nowIso, updated_at: nowIso }).eq("id", pending.id).eq("status", "pending");
      if (error) throw error;
      await admin.from("credential_access_audit_log").insert({ actor_id: profile.id, requester_id: pending.requester_id, request_id: pending.id, vault_entry_id: pending.vault_entry_id, action: `${pending.request_type}_${decision}`, details: { access_minutes: decision === "approved" ? minutes : 0 } });
      return json({ ok: true });
    }

    if (action === "reveal") {
      const { data: access } = await admin.from("credential_access_requests").select("*, entry:credential_vault_entries(*)").eq("id", body.requestId).eq("requester_id", profile.id).eq("request_type", "item").eq("status", "approved").gt("expires_at", nowIso).single();
      if (!access?.entry) return json({ error: "This approval is missing or expired" }, 403);
      const { data: activeCatalog } = await admin.from("credential_access_requests").select("id").eq("id", access.catalog_request_id).eq("requester_id", profile.id).eq("status", "approved").gt("expires_at", nowIso).maybeSingle();
      if (!activeCatalog) return json({ error: "Your catalog approval expired; begin with a new first-stage request" }, 403);
      const secret = await decryptSecret(access.entry.encrypted_secret, access.entry.encryption_iv);
      await admin.from("credential_access_requests").update({ revealed_at: nowIso, updated_at: nowIso }).eq("id", access.id);
      await audit({ request_id: access.id, vault_entry_id: access.vault_entry_id, action: "credential_revealed", details: { visible_seconds: 60 } });
      return json({ secret, websiteName: access.entry.website_name, websiteUrl: access.entry.website_url, hideAt: new Date(now.getTime() + 60_000).toISOString() });
    }

    if (action === "save_entry") {
      if (!isApprover) return json({ error: "Only Jorge or Natalia can manage account records" }, 403);
      const websiteName = String(body.websiteName || "").trim();
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!websiteName || !username || !password) return json({ error: "Website, username, and password are required" }, 422);
      const encrypted = await encryptSecret({ username, password, notes: String(body.secretNotes || "") });
      const values = { website_name: websiteName, website_url: String(body.websiteUrl || "").trim(), category: String(body.category || "Other"), ...encrypted, is_active: true, updated_by: profile.id, updated_at: nowIso };
      const result = body.entryId
        ? await admin.from("credential_vault_entries").update(values).eq("id", body.entryId).select("id").single()
        : await admin.from("credential_vault_entries").insert({ ...values, created_by: profile.id }).select("id").single();
      if (result.error) throw result.error;
      await audit({ vault_entry_id: result.data.id, action: body.entryId ? "vault_entry_updated" : "vault_entry_created", details: { website_name: websiteName } });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Account access request failed" }, 500);
  }
});
