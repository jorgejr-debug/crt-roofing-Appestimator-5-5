import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const ui = fs.readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260831183000_external_proposal_documents.sql", import.meta.url), "utf8");

test("proposal workstation replaces the confusing production gate panel with a simple Miguel handoff", () => {
  assert.doesNotMatch(ui, /BLOCKED FROM PRODUCTION/);
  assert.doesNotMatch(ui, />Release to Production</);
  assert.doesNotMatch(ui, /className="panel productionGate"/);
  assert.match(ui, /Send Approved Job to Miguel/);
  assert.match(ui, /Approved job sent to Miguel/);
});

test("the Miguel handoff remains unavailable until every production safeguard passes", () => {
  assert.match(ui, /latestVersion\.customer_decision === "signed"/);
  assert.match(ui, /blockers\.length === 0/);
  assert.match(migration, /Proposal not finalized/);
  assert.match(migration, /Salesperson scope approval missing/);
  assert.match(migration, /Customer signature missing/);
  assert.match(migration, /Authorized production scope missing/);
  assert.match(migration, /Required deposit not received/);
  assert.match(migration, /Required change order not signed/);
});
