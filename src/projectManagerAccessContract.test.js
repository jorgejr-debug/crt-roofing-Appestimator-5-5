import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260915100000_project_manager_role.sql", import.meta.url), "utf8");

test("Miguel receives the dedicated Project Manager role and a production-only navigation", () => {
  assert.match(appSource, /"miguel@crtroofing\.com"[\s\S]*title: "Project Manager \/ Production"/);
  assert.match(appSource, /normalized === "project_manager"/);
  assert.match(appSource, /getEmployeeNavigationKeys/);
  assert.match(appSource, /KPI Scorecards/);
});

test("Project Manager updates use a server allowlist and exclude financial and authority fields", () => {
  assert.match(appSource, /rpc\("save_project_manager_active_job"/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.save_project_manager_active_job/);
  assert.match(migration, /Only an active production job can be updated/);
  assert.match(migration, /Project Managers cannot release, complete, close, or archive jobs/);
  const allowedKeys = migration.match(/allowed_keys constant text\[\] := ARRAY\[([\s\S]*?)\];/)?.[1] || "";
  assert.doesNotMatch(allowedKeys, /contract|price|billing|commission|proposal|customerName|projectName|jobNumber|projectAddress/i);
});

test("Project Manager cannot enter the invoice-authoring or finance workflow", () => {
  assert.match(appSource, /const isFinanceUser = authRole === "admin" \|\| authRole === "cfo"/);
  assert.match(appSource, /const canSubmitInvoiceHandoff = canSubmitJobForInvoice\(authRole\)/);
  assert.match(appSource, /!isProjectManager \? \([\s\S]*Approved bid amount/);
  assert.match(appSource, /!isProjectManager \? \([\s\S]*Total loaded labor cost/);
  assert.match(appSource, /!isProjectManager \? \([\s\S]*Direct cost before operating \/ overhead/);
  assert.match(appSource, /!isProjectManager \? \([\s\S]*Net company profit/);
});

test("migration assigns Miguel without recreating his existing auth account", () => {
  assert.match(migration, /UPDATE public\.user_profiles[\s\S]*miguel@crtroofing\.com/);
  assert.match(migration, /role = 'project_manager'/);
  assert.doesNotMatch(migration, /auth\.users|invite/i);
});
