import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "Content-Type": "application/json" };
const escapeHtml = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  const expectedSecret = Deno.env.get("TASK_NOTIFICATION_WEBHOOK_SECRET");
  if (!expectedSecret || request.headers.get("x-task-webhook-secret") !== expectedSecret) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  const payload = await request.json();
  if (payload.type !== "INSERT" || payload.table !== "proposal_request_notifications" || !payload.record?.id) return new Response(JSON.stringify({ ok: true, skipped: true }), { headers });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("TASK_NOTIFICATION_FROM_EMAIL");
  const appUrl = Deno.env.get("TASK_NOTIFICATION_APP_URL") || "https://crt-roofing-estimator.vercel.app/";
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) return new Response(JSON.stringify({ error: "Email service is not configured" }), { status: 500, headers });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: notification } = await admin.from("proposal_request_notifications").select("*").eq("id", payload.record.id).single();
  if (!notification || notification.email_status !== "pending") return new Response(JSON.stringify({ ok: true, skipped: true }), { headers });
  const [recipientResult, requestResult, actorResult] = await Promise.all([
    admin.from("user_profiles").select("full_name,email").eq("id", notification.user_id).single(),
    admin.from("proposal_requests").select("request_number,property_name,customer_name,status,target_completion_at").eq("id", notification.proposal_request_id).single(),
    notification.actor_id ? admin.from("user_profiles").select("full_name,email").eq("id", notification.actor_id).single() : Promise.resolve({ data: null }),
  ]);
  const recipient = recipientResult.data;
  const proposal = requestResult.data;
  if (!recipient?.email || !proposal) {
    await admin.from("proposal_request_notifications").update({ email_status: "failed", email_error: "Recipient or proposal request not found" }).eq("id", notification.id);
    return new Response(JSON.stringify({ error: "Recipient or proposal request not found" }), { status: 422, headers });
  }
  const subject = `Proposal Request #${proposal.request_number}: ${String(notification.notification_type).replaceAll("_", " ")}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#102536;line-height:1.5;max-width:640px;margin:auto">
    <h1 style="font-size:24px">CRT Roofing Proposal Request update</h1>
    <p>Hi ${escapeHtml(recipient.full_name || recipient.email.split("@")[0])},</p>
    <p>${escapeHtml(notification.message)}</p>
    <div style="border:1px solid #b9dcf5;border-radius:12px;padding:18px;background:#f6fbff">
      <strong>#${proposal.request_number} — ${escapeHtml(proposal.property_name)}</strong>
      <p>${escapeHtml(proposal.customer_name)}<br>Status: ${escapeHtml(proposal.status)}${proposal.target_completion_at ? `<br>Target: ${escapeHtml(new Date(proposal.target_completion_at).toLocaleString())}` : ""}</p>
      ${actorResult.data ? `<small>Updated by ${escapeHtml(actorResult.data.full_name || actorResult.data.email)}</small>` : ""}
    </div>
    <p style="margin-top:22px"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#087ec4;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Open Proposal Requests</a></p>
  </div>`;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: fromEmail, to: [recipient.email], subject, html }) });
  if (!response.ok) {
    const error = (await response.text()).slice(0, 1000);
    await admin.from("proposal_request_notifications").update({ email_status: "failed", email_error: error }).eq("id", notification.id);
    return new Response(JSON.stringify({ error: "Email provider rejected the message" }), { status: 502, headers });
  }
  await admin.from("proposal_request_notifications").update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: "" }).eq("id", notification.id);
  return new Response(JSON.stringify({ ok: true }), { headers });
});

