import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const ui = fs.readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260831183000_external_proposal_documents.sql", import.meta.url), "utf8");
const kpis = fs.readFileSync(new URL("./crmLeadWorkflow.js", import.meta.url), "utf8");

test("Daniela has an explicit proposal completion action after salesperson approval", () => {
  assert.match(ui, /Proposal Approved &amp; Sent to Customer/);
  assert.match(ui, /latestVersion\.sales_approved_at/);
  assert.match(ui, /markProposalApprovedAndSent/);
  assert.match(ui, /mark_external_proposal_sent/);
  assert.match(ui, /Confirm that the salesperson approved this proposal/);
});

test("proposal completion is timestamped, audited, and available to Daniela's KPI", () => {
  assert.match(migration, /SET sent_at=coalesce\(sent_at,now\(\)\)/);
  assert.match(migration, /status='sent',sent_at=coalesce\(sent_at,now\(\)\)/);
  assert.match(migration, /write_proposal_audit\(request\.id,'proposal_sent'/);
  assert.match(kpis, /sentCount:/);
  assert.match(ui, /Daniela's completion timestamp was recorded for KPI tracking/);
});
