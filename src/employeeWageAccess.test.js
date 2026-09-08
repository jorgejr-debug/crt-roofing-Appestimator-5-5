import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260824234000_cfo_employee_wage_management.sql", import.meta.url),
  "utf8",
);

test("CFO and admin roles can open employee wage administration", () => {
  assert.match(appSource, /const canManageEmployeeWages = isFinanceUser;/);
  assert.match(appSource, /!canManageEmployeeWages && activeTemplate === "administration"/);
});

test("employee wage management remains restricted by RLS", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.employees/i);
  assert.match(migration, /hourly_rate numeric NOT NULL DEFAULT 0 CHECK \(hourly_rate >= 0\)/i);
  assert.match(migration, /ALTER TABLE public\.employees ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /CREATE POLICY employees_finance_manage[\s\S]*FOR ALL[\s\S]*IN \('admin', 'cfo'\)/i);
  assert.doesNotMatch(migration, /DISABLE ROW LEVEL SECURITY/i);
});
