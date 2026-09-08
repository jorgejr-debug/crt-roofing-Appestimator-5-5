import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20260831120000_proposal_request_workflow.sql", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/execute-proposal/index.ts", import.meta.url), "utf8");

test("proposal workflow tables enable RLS and expose select-only participant policies", () => {
  for (const table of ["proposal_requests", "proposal_request_attachments", "proposal_versions", "proposal_change_orders", "proposal_request_audit_events", "proposal_request_notifications"]) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.doesNotMatch(migration, /CREATE POLICY proposal_requests_[\s\S]{0,80}FOR (INSERT|DELETE)/);
});

test("customer signatures require one-time expiring token and service role", () => {
  assert.match(migration, /token_hash=encode\(digest\(p_raw_token,'sha256'\),'hex'\)/);
  assert.match(migration, /used_at IS NULL AND expires_at>now\(\)/);
  assert.match(migration, /IF auth\.role\(\)<>'service_role'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.complete_customer_proposal_decision[\s\S]*FROM PUBLIC,anon,authenticated/);
  assert.match(edge, /complete_customer_proposal_decision/);
});

test("release gate checks every required authorization control", () => {
  for (const requirement of ["Proposal not finalized", "Salesperson scope approval missing", "Customer signature missing", "Authorized production scope missing", "Required deposit not received", "Required change order not signed"]) {
    assert.match(migration, new RegExp(requirement));
  }
  assert.match(migration, /IF NOT public\.is_proposal_manager\(\) OR trim\(coalesce\(p_override_reason,''\)\)=''/);
  assert.match(migration, /'production_override'/);
});

test("proposal-created jobs carry authorized and not-authorized scope", () => {
  assert.match(migration, /'authorizedScope',request\.production_scope->'authorized'/);
  assert.match(migration, /'notAuthorizedScope',request\.production_scope->'not_authorized'/);
  assert.match(migration, /production_authorization_source/);
});

test("sales review acknowledgement and SLA pause resume are server-enforced", () => {
  assert.match(migration, /Assigned salesperson approval required/);
  assert.match(migration, /Scope acknowledgement is required/);
  assert.match(migration, /sla_paused_at=now\(\)/);
  assert.match(migration, /sla_paused_seconds=sla_paused_seconds\+CASE/);
});

test("rush approval, task integration, audit, and notifications are present", () => {
  assert.match(migration, /rush_approval_status='pending'/);
  assert.match(migration, /task_type.*proposal_request/);
  assert.match(migration, /write_proposal_audit/);
  assert.match(migration, /proposal_request_notifications/);
  assert.match(migration, /enqueue_overdue_proposal_notifications/);
});

test("Daniela's estimating intake fields are stored and enforced server-side", () => {
  for (const field of [
    "project_contact_first_name", "project_contact_last_name", "project_contact_phone", "project_contact_email",
    "roof_measurement_notes", "property_type", "story_count", "construction_type", "total_linear_feet",
    "tear_off_details", "parapet_wall_measurements", "roof_access_details", "permit_requirements",
    "subcontractor_requirements", "overspray_risk_notes", "weekend_work_availability",
  ]) assert.match(migration, new RegExp(field));
  assert.match(migration, /Project contact phone number/);
  assert.match(migration, /Roof measurement notes/);
  assert.match(migration, /Existing roof or new construction/);
});
