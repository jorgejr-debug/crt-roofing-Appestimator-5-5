import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260828153000_daniela_daily_job_cost_access.sql", import.meta.url), "utf8");

test("Daniela sees the daily job cost action without seeing full job-management actions", () => {
  assert.match(appSource, /const canUpdateDailyJobCostData = canUpdateDailyJobCosts\(authRole, authUser\?\.email\)/);
  assert.match(appSource, /\{canUpdateDailyJobCostData \? \([\s\S]*?Update Daily Job Cost/);
  assert.match(appSource, /\{canSubmitInvoiceHandoff \? \([\s\S]*?Complete Job &amp; Send to Invoicing/);
  assert.match(appSource, /const canSubmitInvoiceHandoff = canSubmitJobForInvoice\(authRole\)/);
});

test("staff saves use a narrowly scoped one-day server function", () => {
  assert.match(appSource, /buildSharedJobSourceId,[\s\S]*?from "\.\/sharedJobWorkflow\.js"/);
  assert.match(appSource, /supabase\.rpc\("save_staff_daily_job_progress_day"/);
  assert.match(migration, /auth\.jwt\(\) ->> 'email'[\s\S]*?daniela@crtroofing\.com/);
  assert.match(migration, /day_id text :=[\s\S]*?p_day ->> 'id'/);
  assert.match(migration, /lower\(coalesce\(jobs\.workflow_status, ''\)\) IN \('approved', 'active'\)/);
  assert.doesNotMatch(migration, /SET[\s\S]*?\b(status|contract_amount|change_orders|actual_cost)\s*=/i);
});
