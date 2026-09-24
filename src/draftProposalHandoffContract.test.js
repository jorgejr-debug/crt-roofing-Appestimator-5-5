import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260922100000_draft_proposal_handoff.sql", import.meta.url), "utf8");

test("an authorized inspector can attach a PDF or Word draft proposal to the mobile handoff", () => {
  assert.match(app, /Upload Inspector's Draft Proposal/);
  assert.match(app, /DRAFT_PROPOSAL_FILE_ACCEPT/);
  assert.match(app, /pendingDraftProposalFiles/);
  assert.match(app, /p_has_draft_proposal: draftUpload\.uploaded\.length > 0/);
  assert.match(app, /customer_document/);
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

test("draft proposal remains subject to final sales review and production controls", () => {
  assert.match(app, /SALES_APPROVAL_ACKNOWLEDGEMENT/);
  assert.match(app, /Send Approved Job to Miguel/);
  assert.match(app, /blockers\.length === 0/);
  assert.match(app, /Final customer PDF \(required for Sales Review\)/);
});
