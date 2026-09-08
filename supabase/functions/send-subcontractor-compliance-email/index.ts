import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "Content-Type": "application/json" };
const escapeHtml = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  const expectedSecret = Deno.env.get("TASK_NOTIFICATION_WEBHOOK_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const hasSharedSecret = Boolean(expectedSecret) && request.headers.get("x-task-webhook-secret") === expectedSecret;
  const hasServiceRole = Boolean(serviceRoleKey) && request.headers.get("authorization") === `Bearer ${serviceRoleKey}`;
  if (!hasSharedSecret && !hasServiceRole) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  const payload = await request.json();
  if (payload.type !== "INSERT" || payload.table !== "subcontractor_compliance_notifications" || !payload.record?.id) return new Response(JSON.stringify({ ok: true, skipped: true }), { headers });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("TASK_NOTIFICATION_FROM_EMAIL");
  const appUrl = Deno.env.get("TASK_NOTIFICATION_APP_URL") || "https://crt-roofing-estimator.vercel.app/";
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) return new Response(JSON.stringify({ error: "Email service is not configured" }), { status: 500, headers });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: notification } = await admin.from("subcontractor_compliance_notifications").select("*").eq("id", payload.record.id).single();
  if (!notification || notification.email_status !== "pending") return new Response(JSON.stringify({ ok: true, skipped: true }), { headers });
  const [subcontractorResult, nataliaResult] = await Promise.all([
    admin.from("subcontractors").select("company_name,trade,contact_name,phone,email,license_status,license_number,workers_comp_expiration_date,coi_names_crt_insured,coi_file_name").eq("id", notification.subcontractor_id).single(),
    admin.from("user_profiles").select("full_name,email").ilike("email", "natalia@crtroofing.com").limit(1).maybeSingle(),
  ]);
  const subcontractor = subcontractorResult.data;
  const natalia = nataliaResult.data;
  if (!subcontractor || !natalia?.email) {
    const reason = "Natalia or subcontractor record was not found";
    await admin.from("subcontractor_compliance_notifications").update({ email_status: "failed", email_error: reason }).eq("id", notification.id);
    return new Response(JSON.stringify({ error: reason }), { status: 422, headers });
  }
  const days = Number(notification.days_remaining);
  const timing = days < 0 ? `expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago` : days === 0 ? "expires today" : `expires in ${days} day${days === 1 ? "" : "s"}`;
  const subject = `COI follow-up: ${subcontractor.company_name} workers' comp ${timing}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#102536;line-height:1.5;max-width:640px;margin:auto">
    <h1 style="font-size:24px">Subcontractor COI follow-up</h1>
    <p>Hi ${escapeHtml(natalia.full_name || "Natalia")},</p>
    <p><strong>${escapeHtml(subcontractor.company_name)}</strong>'s workers' compensation ${escapeHtml(timing)}. Please obtain an updated certificate of insurance.</p>
    <div style="border:1px solid #b9dcf5;border-radius:12px;padding:18px;background:#f6fbff">
      <strong>${escapeHtml(subcontractor.company_name)}</strong><br>
      Trade: ${escapeHtml(subcontractor.trade)}<br>Contact: ${escapeHtml(subcontractor.contact_name)}<br>
      Phone: ${escapeHtml(subcontractor.phone || "Not provided")}<br>Email: ${escapeHtml(subcontractor.email || "Not provided")}<br>
      License: ${escapeHtml(subcontractor.license_status === "licensed" ? subcontractor.license_number : "Non-licensed")}<br>
      Workers' comp expiration: ${escapeHtml(subcontractor.workers_comp_expiration_date)}<br>
      Current COI names CRT Roofing: ${subcontractor.coi_names_crt_insured ? "Yes" : "No"}
    </div>
    <p style="margin-top:22px"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#087ec4;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Open Subcontractor Compliance</a></p>
  </div>`;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: fromEmail, to: [natalia.email], subject, html }) });
  if (!response.ok) {
    const providerError = (await response.text()).slice(0,1000);
    await admin.from("subcontractor_compliance_notifications").update({ email_status: "failed", email_error: providerError }).eq("id", notification.id);
    return new Response(JSON.stringify({ error: "Email provider rejected the message" }), { status: 502, headers });
  }
  await admin.from("subcontractor_compliance_notifications").update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: "" }).eq("id", notification.id);
  return new Response(JSON.stringify({ ok: true }), { headers });
});
