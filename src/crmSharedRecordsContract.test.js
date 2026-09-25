import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const migrationSource = fs.readFileSync(new URL("../supabase/migrations/20260925100000_shared_crm_customers_and_followups.sql", import.meta.url), "utf8");

test("customer records and reminders are shared and realtime", () => {
  assert.match(appSource, /fetchCrmCustomersFromSupabase/);
  assert.match(appSource, /fetchCrmFollowupsFromSupabase/);
  assert.match(appSource, /table: "crm_customers"/);
  assert.match(appSource, /table: "crm_followups"/);
  assert.match(appSource, /CRM_CUSTOMERS_MIGRATED_KEY/);
  assert.match(appSource, /CRM_FOLLOWUPS_MIGRATED_KEY/);
});

test("shared customer payload excludes legacy embedded files and proposal documents", () => {
  assert.match(appSource, /const sharedPayload = \{[\s\S]*files: \[\],[\s\S]*proposalArchive: \[\]/);
  assert.match(appSource, /customer_payload: sharedPayload/);
});

test("shared CRM records use role-based RLS and restricted deletion", () => {
  assert.match(migrationSource, /ALTER TABLE public\.crm_customers ENABLE ROW LEVEL SECURITY/);
  assert.match(migrationSource, /ALTER TABLE public\.crm_followups ENABLE ROW LEVEL SECURITY/);
  assert.match(migrationSource, /public\.can_use_crm\(\)/);
  assert.match(migrationSource, /crm_customers_delete_management/);
  assert.match(migrationSource, /crm_followups_delete_owner_or_management/);
  assert.doesNotMatch(migrationSource, /project_manager/);
});

test("shared saves and deletes wait for the database before confirming success", () => {
  assert.match(appSource, /const saveCrmCustomerDraft = async/);
  assert.match(appSource, /const saveCrmFollowupDraft = async/);
  assert.match(appSource, /Customer was not saved:/);
  assert.match(appSource, /Reminder was not saved:/);
  assert.match(appSource, /deleteCrmCustomerFromSupabase/);
  assert.match(appSource, /deleteCrmFollowupFromSupabase/);
});
