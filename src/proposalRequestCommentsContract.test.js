import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260923180000_proposal_request_comments.sql", import.meta.url), "utf8");
const permissionsMigration = readFileSync(new URL("../supabase/migrations/20260923181500_lock_down_proposal_comments.sql", import.meta.url), "utf8");
const email = readFileSync(new URL("../supabase/functions/send-proposal-notification-email/index.ts", import.meta.url), "utf8");

test("proposal detail includes a persistent comment thread and composer", () => {
  assert.match(ui, /Proposal conversation/);
  assert.match(ui, /proposal_request_comments/);
  assert.match(ui, /add_proposal_request_comment/);
  assert.match(ui, /Add Comment & Notify/);
});

test("comments are guarded, immutable, and visible only to proposal participants", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /can_access_proposal_request\(proposal_request_id\)/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.doesNotMatch(migration, /GRANT (INSERT|UPDATE|DELETE)/);
  assert.match(permissionsMigration, /REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER/);
  assert.match(permissionsMigration, /FROM authenticated/);
  assert.match(migration, /BETWEEN 1 AND 4000/);
});

test("comments notify the counterpart by email without notifying the author", () => {
  assert.match(migration, /'comment_added'/);
  assert.match(migration, /candidate<>auth\.uid\(\)/);
  assert.match(migration, /request\.salesperson_id/);
  assert.match(migration, /request\.created_by/);
  assert.match(migration, /assigned_estimator_id/);
  assert.match(email, /proposal_request_notifications/);
});

test("comment activity is auditable and realtime", () => {
  assert.match(migration, /write_proposal_audit/);
  assert.match(migration, /supabase_realtime ADD TABLE public\.proposal_request_comments/);
  assert.match(ui, /postgres_changes/);
});
