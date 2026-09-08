import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const queueSource = fs.readFileSync(new URL("./InvoiceQueue.jsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260908130000_invoice_request_workflow.sql", import.meta.url), "utf8");
const customerEmailFunction = fs.readFileSync(new URL("../supabase/functions/send-customer-invoice/index.ts", import.meta.url), "utf8");
const notificationFunction = fs.readFileSync(new URL("../supabase/functions/send-invoice-notification-email/index.ts", import.meta.url), "utf8");

test("only admin and CFO roles can close active jobs into the invoice workflow", () => {
  assert.match(appSource, /const canSubmitInvoiceHandoff = canSubmitJobForInvoice\(authRole\)/);
  assert.match(migration, /lower\(coalesce\(actor\.role, ''\)\) NOT IN \('admin', 'cfo'\)/);
  assert.match(migration, /lower\(coalesce\(job\.workflow_status, ''\)\) <> 'active'/);
});

test("invoice requests are durable, audited, and protected by RLS", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.invoice_requests/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.invoice_request_audit_log/);
  assert.match(migration, /ALTER TABLE public\.invoice_requests ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /public\.can_manage_invoice_workflow\(\) OR submitted_by = auth\.uid\(\)/);
  assert.match(migration, /'submitted_for_invoicing'/);
});

test("Natalia has an invoice queue with a required PDF before sending", () => {
  assert.match(queueSource, /Upload Invoice PDF/);
  assert.match(queueSource, /Send Invoice to Customer/);
  assert.match(migration, /Invoice number, due date, and PDF are required before sending/);
  assert.match(migration, /natalia@crtroofing\.com/);
});

test("customer invoice email copies Natalia and creates one stable receivable", () => {
  assert.match(customerEmailFunction, /cc: \["natalia@crtroofing\.com"\]/);
  assert.match(customerEmailFunction, /reply_to: "accounting@crtroofing\.com"/);
  assert.match(customerEmailFunction, /receivable:waitingOnPayment:invoice-\$\{invoice\.id\}/);
  assert.match(customerEmailFunction, /onConflict: "source_record_uid"/);
  assert.match(customerEmailFunction, /eq\("status", "Ready to Send"\)/);
  assert.match(customerEmailFunction, /receivable_sync_failed/);
});

test("invoice handoff notification uses the protected webhook secret", () => {
  assert.match(notificationFunction, /TASK_NOTIFICATION_WEBHOOK_SECRET/);
  assert.match(notificationFunction, /x-task-webhook-secret/);
  assert.match(notificationFunction, /accounting@crtroofing\.com/);
});
