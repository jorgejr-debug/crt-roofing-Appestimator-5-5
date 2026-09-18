import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const proposalUi = fs.readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260918113000_crm_proposal_job_attribution.sql", import.meta.url), "utf8");

test("proposal requests can be created from a shared CRM lead", () => {
  assert.match(proposalUi, /Source CRM lead/);
  assert.match(proposalUi, /applyCrmLead/);
  assert.match(proposalUi, /existing_lead_job_id: lead\.id/);
  assert.match(proposalUi, /Lead originated by/);
});

test("lead originator attribution is immutable and follows the proposal into production", () => {
  assert.match(migration, /preserve_crm_lead_originator/);
  assert.match(migration, /NEW\.originator_id := OLD\.originator_id/);
  assert.match(migration, /assign_proposal_lead_attribution/);
  assert.match(migration, /carry_lead_attribution_to_job/);
  assert.match(migration, /'commissionRecipientEmail', request\.lead_originator_email/);
});

test("Chris receives a 25 percent rate only when he originated the CRM lead", () => {
  assert.match(migration, /lower\(request\.lead_originator_email\) = 'chris@crtroofing\.com' THEN 0\.25/);
});
