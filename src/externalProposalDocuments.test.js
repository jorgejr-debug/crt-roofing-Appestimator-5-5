import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20260831183000_external_proposal_documents.sql", import.meta.url), "utf8");
const ui = readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("external proposal versions require Word source and final PDF for Sales Review", () => {
  assert.match(migration, /A Word \.docx proposal is required/);
  assert.match(migration, /A finalized PDF is required for Sales Review/);
  assert.match(migration, /save_external_proposal_version/);
});

test("signed PDF and approved sections are required before production", () => {
  assert.match(migration, /Signed proposal PDF is required/);
  assert.match(migration, /At least one approved section is required/);
  assert.match(migration, /Signed proposal document missing/);
  assert.match(migration, /production_scope=jsonb_build_object/);
});

test("Proposal tab is a document workflow rather than the legacy builder", () => {
  assert.match(ui, /Prepare the proposal in Microsoft Word/);
  assert.match(ui, /Record signed proposal/);
  assert.doesNotMatch(ui, /Open in Proposal Builder/);
  assert.match(app, /key: "proposalRequests", label: "Proposals"/);
});

test("Daniela can review the entire submitted request and its attachments", () => {
  assert.match(ui, /Submitted Request Details/);
  assert.match(ui, /textFields\.map/);
  assert.match(ui, /Customer \/ Job Information/);
  assert.match(ui, /Scope Information/);
  assert.match(ui, /Production Assumptions/);
  assert.match(ui, /Pricing \/ Estimating/);
  assert.match(ui, /Open \{item\.file_name\}/);
});
