import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260922100000_draft_proposal_handoff.sql", import.meta.url), "utf8");

test("proposal requests accept PDF or Word drafts through protected attachments", () => {
  assert.match(app, /PROPOSAL_REQUEST_FILE_ACCEPT/);
  assert.match(app, /Photos & supporting files/);
  assert.match(app, /Ready to upload when you save or submit/);
  assert.match(app, /uploadFilesToRequest/);
});

test("draft handoff waits for Daniela before beginning the estimating SLA", () => {
  assert.match(migration, /draft_handoff_status='awaiting_review'/);
  assert.match(migration, /target_completion_at=NULL/);
  assert.match(migration, /review_draft_proposal_handoff/);
  assert.match(migration, /draft_handoff_status='accepted'/);
  assert.match(migration, /SLA started/);
  assert.match(app, /Accept &amp; Start Estimating/);
  assert.match(app, /Request Information/);
});

test("retired quick inspection entry points are absent while historical packets remain readable", () => {
  assert.doesNotMatch(app, /extract-inspection-handoff/);
  assert.doesNotMatch(app, /Quick Inspection Handoff/);
  assert.doesNotMatch(app, /Organize PLAUD Inspection/);
  assert.match(app, /Historical Inspection Packet/);
  assert.match(app, /Original inspection summary or transcript/);
});

test("draft proposal remains subject to final sales review and production controls", () => {
  assert.match(app, /SALES_APPROVAL_ACKNOWLEDGEMENT/);
  assert.match(app, /Send Approved Job to Miguel/);
  assert.match(app, /blockers\.length === 0/);
  assert.match(app, /Final customer PDF \(required for Sales Review\)/);
});
