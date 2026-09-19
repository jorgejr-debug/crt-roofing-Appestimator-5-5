import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260918100000_shared_crm_leads_and_kpi_targets.sql", import.meta.url), "utf8");

test("CRM includes a mobile-first quick capture and a separate qualification workspace", () => {
  assert.match(app, /Quick Lead Capture/);
  assert.match(app, /Save &amp; Add Next/);
  assert.match(app, /Qualify \/ Edit Lead/);
  assert.match(app, /Continue to Qualification/);
});

test("shared leads preserve originator attribution and project managers cannot access CRM data", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.crm_leads/);
  assert.match(migration, /originator_id uuid NOT NULL/);
  assert.match(migration, /relationship_owner_id uuid/);
  assert.match(migration, /IN \('admin', 'cfo', 'salesperson', 'estimator'\)/);
  assert.doesNotMatch(migration, /IN \('admin', 'cfo', 'salesperson', 'estimator', 'project_manager'\)/);
});

test("Chris KPI is driven by explicit attribution and inspection capacity", () => {
  assert.match(app, /Chris · Business Development KPI/);
  assert.match(app, /originatorEmail: "chris@crtroofing\.com"/);
  assert.match(app, /Ivan's weekly inspection capacity target/);
  assert.match(app, /25% commission must be calculated from finalized job gross profit/);
});

test("Ivan KPI separates capacity supply from controllable execution and proposal quality", () => {
  assert.match(app, /Ivan · Estimator \/ Technician KPI/);
  assert.match(app, /Overall KPI score/);
  assert.match(app, /Lead supply/);
  assert.match(app, /Customer contact SLA/);
  assert.match(app, /Proposal handoff SLA/);
  assert.match(app, /First-pass completeness/);
  assert.match(app, /Inspection execution 35%/);
  assert.match(app, /fetchCrmProposalRequestsFromSupabase/);
});

test("Daniela KPI measures controllable proposal response, turnaround, documents, and queue hygiene", () => {
  assert.match(app, /Daniela · Proposal & Estimating KPI/);
  assert.match(app, /Intake response SLA/);
  assert.match(app, /On-time proposal handoff/);
  assert.match(app, /Complete Word \+ PDF handoff/);
  assert.match(app, /Returned for missing info/);
  assert.match(app, /does not lower Daniela's score/);
  assert.match(app, /On-time proposal handoff 45%/);
  assert.match(app, /fetchCrmProposalAuditEventsFromSupabase/);
});

test("Miguel KPI measures production execution without exposing finance data", () => {
  assert.match(app, /Miguel · Project Manager \/ Production KPI/);
  assert.match(app, /Scheduling response/);
  assert.match(app, /Daily job-log coverage/);
  assert.match(app, /On-time completion/);
  assert.match(app, /Current job updates/);
  assert.match(app, /On-time completion 35%/);
  assert.match(app, /department-owned material or document delays are context/);
  assert.match(app, /key: "kpis", label: "KPI Scorecards"/);
});
