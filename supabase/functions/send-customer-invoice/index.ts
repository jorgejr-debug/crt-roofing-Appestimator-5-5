import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + 0x8000, bytes.length)));
  }
  return btoa(binary);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("INVOICE_FROM_EMAIL") || "CRT Roofing Accounting <accounting@crtroofing.com>";
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) return json({ error: "Invoice email service is not configured" }, 500);

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: userResult, error: userError } = await caller.auth.getUser(token);
  if (userError || !userResult.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile } = await admin.from("user_profiles").select("id,full_name,email,role").eq("id", userResult.user.id).single();
  const canSend = profile && (['admin', 'cfo'].includes(String(profile.role || '').toLowerCase()) || String(profile.email || '').toLowerCase() === 'natalia@crtroofing.com');
  if (!canSend) return json({ error: "Only Natalia, an admin, or a CFO can send invoices" }, 403);

  const { requestId } = await request.json();
  const { data: invoice, error: invoiceError } = await admin.from("invoice_requests").select("*").eq("id", requestId).single();
  if (invoiceError || !invoice) return json({ error: "Invoice request not found" }, 404);
  if (invoice.status === "Sent") return json({ error: "This invoice has already been sent" }, 409);
  if (invoice.status !== "Ready to Send") return json({ error: "Complete the invoice and mark it Ready to Send first" }, 422);
  if (!invoice.invoice_number || !invoice.due_date || !invoice.invoice_storage_path) return json({ error: "Invoice number, due date, and PDF are required" }, 422);

  const { data: claimedInvoice, error: claimError } = await admin.from("invoice_requests")
    .update({ status: "Sending", send_error: "", updated_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .eq("status", "Ready to Send")
    .select("id")
    .maybeSingle();
  if (claimError || !claimedInvoice) return json({ error: "This invoice is already being sent or its status changed" }, 409);
  const { data: fileData, error: fileError } = await admin.storage.from("invoice-documents").download(invoice.invoice_storage_path);
  if (fileError || !fileData) {
    await admin.from("invoice_requests").update({ status: "Send Failed", send_error: fileError?.message || "Invoice PDF could not be downloaded", updated_at: new Date().toISOString() }).eq("id", invoice.id);
    return json({ error: "Invoice PDF could not be downloaded" }, 422);
  }

  const attachmentBytes = new Uint8Array(await fileData.arrayBuffer());
  const amount = Number(invoice.amount_to_invoice || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const subject = `CRT Roofing Invoice ${invoice.invoice_number}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#102536;line-height:1.5;max-width:640px;margin:auto">
    <h1 style="font-size:24px">CRT Roofing Invoice ${escapeHtml(invoice.invoice_number)}</h1>
    <p>Hello ${escapeHtml(invoice.billing_contact_name)},</p>
    <p>Please find attached the invoice for ${escapeHtml(invoice.project_name || invoice.job_number || invoice.customer_name)}.</p>
    <div style="border:1px solid #b9dcf5;border-radius:12px;padding:18px;background:#f6fbff">
      <p><strong>Invoice amount:</strong> ${escapeHtml(amount)}<br><strong>Due date:</strong> ${escapeHtml(invoice.due_date)}<br><strong>Payment terms:</strong> ${escapeHtml(invoice.payment_terms)}</p>
    </div>
    <p>Questions and payment confirmations can be sent by replying to this email.</p>
    <p>Thank you,<br>CRT Roofing Accounting</p>
  </div>`;
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [invoice.billing_email],
      cc: ["natalia@crtroofing.com"],
      reply_to: "accounting@crtroofing.com",
      subject,
      html,
      attachments: [{ filename: invoice.invoice_file_name || `${invoice.invoice_number}.pdf`, content: bytesToBase64(attachmentBytes) }],
    }),
  });
  if (!resendResponse.ok) {
    const providerError = (await resendResponse.text()).slice(0, 1000);
    await admin.from("invoice_requests").update({ status: "Send Failed", send_error: providerError, updated_at: new Date().toISOString() }).eq("id", invoice.id);
    await admin.from("invoice_request_audit_log").insert({ invoice_request_id: invoice.id, actor_id: profile.id, action: "invoice_send_failed", notes: providerError });
    return json({ error: "The email provider rejected the invoice" }, 502);
  }

  const providerResult = await resendResponse.json();
  const sentAt = new Date().toISOString();
  await admin.from("invoice_requests").update({ status: "Sent", sent_at: sentAt, sent_by: profile.id, resend_email_id: providerResult.id || "", send_error: "", updated_at: sentAt }).eq("id", invoice.id);
  await admin.from("invoice_request_audit_log").insert({ invoice_request_id: invoice.id, actor_id: profile.id, action: "invoice_sent", notes: `Invoice ${invoice.invoice_number} sent to ${invoice.billing_email}`, details: { resend_email_id: providerResult.id || "", cc: "natalia@crtroofing.com" } });
  const { error: receivableError } = await admin.from("company_financial_records").upsert({
    source_record_uid: `receivable:waitingOnPayment:invoice-${invoice.id}`,
    record_type: "receivable",
    card_key: "waitingOnPayment",
    customer_name: invoice.customer_name,
    record_name: invoice.invoice_number,
    amount: invoice.amount_to_invoice,
    period_from_date: invoice.sent_at ? String(invoice.sent_at).slice(0, 10) : sentAt.slice(0, 10),
    period_to_date: invoice.due_date,
    status: "Waiting on Payment",
    note: `Invoice ${invoice.invoice_number} · Job ${invoice.job_number || invoice.project_name}`,
    record_date: invoice.due_date,
    included_in_total: true,
    is_archived: false,
    row_version: 1,
    updated_by: profile.id,
    updated_at: sentAt,
  }, { onConflict: "source_record_uid" });

  if (receivableError) {
    await admin.from("invoice_request_audit_log").insert({
      invoice_request_id: invoice.id,
      actor_id: profile.id,
      action: "receivable_sync_failed",
      notes: receivableError.message,
    });
    return json({
      ok: true,
      emailId: providerResult.id || "",
      sentAt,
      waitingOnPaymentUpdated: false,
      warning: "The invoice email was sent, but Waiting on Payment could not be updated. Accounting should retry the receivable sync.",
    });
  }

  return json({ ok: true, emailId: providerResult.id || "", sentAt, waitingOnPaymentUpdated: true });
});
