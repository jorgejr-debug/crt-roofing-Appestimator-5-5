import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(new URL("../supabase/migrations/20260827120000_ivan_create_approved_jobs.sql", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("Ivan creates approved jobs through an email-scoped server function", () => {
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /requester_email <> 'ivan@crtroofing\.com'/);
  assert.match(migration, /requester_role NOT IN \('admin', 'cfo'\)/);
  assert.match(migration, /normalized_status IN \('Active', 'Completed', 'Closed'\)/);
  assert.doesNotMatch(migration, /CREATE POLICY/);
  assert.doesNotMatch(migration, /company_financial_records/);
});

test("approved jobs page shows the quick-entry button and uses the server function", () => {
  assert.match(app, /canCreateApprovedJobData \? \([\s\S]*?Add Approved Job/);
  assert.match(app, /createApprovedJobFromStaffDraft\(approvedJobQuickDraft\)/);
});
