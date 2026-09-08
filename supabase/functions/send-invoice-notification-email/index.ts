import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "Content-Type": "application/json" };
const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  const expectedSecret = Deno.env.get("TASK_NOTIFICATION_WEBHOOK_SECRET");
  if (!expectedSecret || request.headers.get("x-task-webhook-secret") !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const payload = await request.json();
  if (payload.type !== "INSERT" || payload.table !== "invoice_request_notifications" || !payload.record?.id) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { headers });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("INVOICE_FROM_EMAIL") || "CRT Roofing Accounting <accounting@crtroofing.com>";
  const appUrl = Deno.env.get("TASK_NOTIFICATION_APP_URL") || "https://crt-roofing-estimator.vercel.app/";
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return new Response(JSON.stringify({ error: "Invoice notification service is not configured" }), { status: 500, headers });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: notification } = await admin.from("invoice_request_notifications").select("*").eq("id", payload.record.id).single();
  if (!notification || notification.email_status !== "pending") return new Response(JSON.stringify({ ok: true, skipped: true }), { headers });

  const [recipientResult, invoiceResult, actorResult] = await Promise.all([
    admin.from("user_profiles").select("full_name,email").eq("id", notification.user_id).single(),
    admin.from("invoice_requests").select("job_number,project_name,customer_name,amount_to_invoice,status").eq("id", notification.invoice_request_id).single(),
    notification.actor_id
      ? admin.from("user_profiles").select("full_name,email").eq("id", notification.actor_id).single()
      : Promise.resolve({ data: null }),
  ]);
  const recipient = recipientResult.data;
  const invoice = invoiceResult.data;
  if (!recipient?.email || !invoice) {
    await admin.from("invoice_request_notifications").update({ email_status: "failed", email_error: "Recipient or invoice request not found" }).eq("id", notification.id);
    return new Response(JSON.stringify({ error: "Recipient or invoice request not found" }), { status: 422, headers });
  }

  const amount = Number(invoice.amount_to_invoice || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const subject = `Ready for invoice: ${invoice.job_number || invoice.project_name || invoice.customer_name}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#102536;line-height:1.5;max-width:640px;margin:auto">
    <h1 style="font-size:24px">A completed job is ready for invoicing</h1>
    <p>Hi ${escapeHtml(recipient.full_name || "Natalia")},</p>
    <p>${escapeHtml(notification.message)}</p>
    <div style="border:1px solid #b9dcf5;border-radius:12px;padding:18px;background:#f6fbff">
      <strong>${escapeHtml(invoice.job_number || "No job number")} — ${escapeHtml(invoice.project_name)}</strong>
      <p>${escapeHtml(invoice.customer_name)}<br>Amount requested: ${escapeHtml(amount)}<br>Status: ${escapeHtml(invoice.status)}</p>
      ${actorResult.data ? `<small>Submitted by ${escapeHtml(actorResult.data.full_name || actorResult.data.email)}</small>` : ""}
    </div>
    <p style="margin-top:22px"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#087ec4;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Open Invoice Requests</a></p>
  </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: [recipient.email], subject, html, reply_to: "accounting@crtroofing.com" }),
  });
  if (!response.ok) {
    const error = (await response.text()).slice(0, 1000);
    await admin.from("invoice_request_notifications").update({ email_status: "failed", email_error: error }).eq("id", notification.id);
    return new Response(JSON.stringify({ error: "Email provider rejected the message" }), { status: 502, headers });
  }

  await admin.from("invoice_request_notifications").update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: "" }).eq("id", notification.id);
  return new Response(JSON.stringify({ ok: true }), { headers });
});

