import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const workHub = readFileSync(new URL("./WorkHub.jsx", import.meta.url), "utf8");
const proposals = readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");

test("Ivan receives a dashboard shortcut into the mobile inspection handoff", () => {
  assert.match(app, /Quick Inspection Handoff/);
  assert.match(app, /setActiveTemplate\("proposalQuickHandoff"\)/);
  assert.match(app, /initialProposalView="quick"/);
  assert.match(workHub, /initialProposalView = "queue"/);
  assert.match(workHub, /initialView=\{initialProposalView\}/);
});

test("quick handoff saves a draft and notifies Daniela without starting the estimating SLA", () => {
  assert.match(proposals, /validateQuickInspectionHandoff/);
  assert.match(proposals, /saveDraft\(quickPayload\)/);
  assert.match(proposals, /create_private_company_task/);
  assert.match(proposals, /p_assignee_ids: \[danielaProfile\.id\]/);
  assert.match(proposals, /remains a Draft/);
  assert.match(proposals, /estimating SLA has not started/);
  assert.match(proposals, /Complete Full Request/);
});

test("quick handoff supports phone notes and protected multi-file attachments", () => {
  assert.match(proposals, /Use your phone's microphone to dictate longer notes/);
  assert.match(proposals, /Main scope observed/);
  assert.match(proposals, /Measurements \/ squares/);
  assert.match(proposals, /Add Roof Photos & Files/);
  assert.match(proposals, /uploadFilesToRequest/);
});
