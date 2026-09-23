import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const workHub = readFileSync(new URL("./WorkHub.jsx", import.meta.url), "utf8");
const proposals = readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");
const handoffMigration = readFileSync(new URL("../supabase/migrations/20260922100000_draft_proposal_handoff.sql", import.meta.url), "utf8");

test("authorized inspectors receive a dashboard shortcut into the mobile inspection handoff", () => {
  assert.match(app, /Quick Inspection Handoff/);
  assert.match(app, /canCreateQuickInspectionHandoff/);
  assert.match(app, /setActiveTemplate\("proposalQuickHandoff"\)/);
  assert.match(app, /initialProposalView="quick"/);
  assert.match(workHub, /initialProposalView = "queue"/);
  assert.match(workHub, /initialView=\{initialProposalView\}/);
});

test("quick handoff saves a draft and notifies Daniela without starting the estimating SLA", () => {
  assert.match(proposals, /validateQuickInspectionHandoff/);
  assert.match(proposals, /saveDraft\(quickPayload\)/);
  assert.match(proposals, /submit_draft_proposal_handoff/);
  assert.match(handoffMigration, /company_task_assignees/);
  assert.match(handoffMigration, /lower\(email\)='daniela@crtroofing\.com'/);
  assert.match(handoffMigration, /draft_handoff_status='awaiting_review'/);
  assert.match(handoffMigration, /target_completion_at=NULL/);
  assert.match(proposals, /Complete Full Request/);
});

test("quick handoff supports phone notes and protected multi-file attachments", () => {
  assert.match(proposals, /Use a PLAUD summary or transcript to organize the field facts/);
  assert.match(proposals, /Main scope observed/);
  assert.match(proposals, /Measurements \/ squares/);
  assert.match(proposals, /Add Roof Photos & Files/);
  assert.match(proposals, /uploadFilesToRequest/);
});

test("management can preserve the correct salesperson attribution", () => {
  assert.match(proposals, /Assigned salesperson \/ account owner/);
  assert.match(proposals, /salesperson_id: draft\.salesperson_id \|\| authUser\.key/);
  assert.match(proposals, /Inspector-Confirmed Field Evidence/);
});
