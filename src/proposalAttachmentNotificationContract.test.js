import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260923160000_proposal_attachment_notifications.sql", import.meta.url), "utf8");
const email = readFileSync(new URL("../supabase/functions/send-proposal-notification-email/index.ts", import.meta.url), "utf8");

test("successful attachment batches notify through the existing proposal email system", () => {
  assert.match(ui, /notify_proposal_attachment_batch/);
  assert.match(ui, /attachmentIds/);
  assert.match(migration, /notification_type,message/);
  assert.match(migration, /'attachments_uploaded'/);
  assert.match(email, /proposal_request_notifications/);
  assert.match(email, /Open Proposal Requests/);
});

test("draft uploads stay quiet and uploaders never notify themselves", () => {
  assert.match(migration, /request\.status='draft'/);
  assert.match(migration, /draft_handoff_status/);
  assert.match(migration, /candidate<>auth\.uid\(\)/);
  assert.match(ui, /saved\.status === "draft"/);
  assert.match(ui, /saved\.uploadedAttachmentIds/);
});

test("one batch records file names, recipients, and an audit event", () => {
  assert.match(migration, /string_agg\(file_name/);
  assert.match(migration, /SELECT DISTINCT candidate/);
  assert.match(migration, /attachment_batch_notified/);
  assert.match(migration, /attachment_count/);
});
