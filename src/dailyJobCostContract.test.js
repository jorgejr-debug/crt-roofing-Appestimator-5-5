import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const employeeDirectoryMigration = fs.readFileSync(
  new URL("../supabase/migrations/20260828190000_daily_job_cost_employee_directory.sql", import.meta.url),
  "utf8",
);

test("daily job cost selects saved employees and locks the saved wage", () => {
  assert.match(source, /<Field label="CRT employee">[\s\S]*?employeeDirectory\.filter\(\(person\) => person\.isActive\)/);
  assert.match(source, /<Field label="Base hourly wage">[\s\S]*?value=\{laborCost\.hourlyRate\} disabled/);
  assert.match(source, /key === "employeeId"[\s\S]*?hourlyRate: selectedEmployee && toNumber\(selectedEmployee\.hourlyRate\) > 0[\s\S]*?toNumber\(row\.hourlyRate\)/);
});

test("daily job cost editors receive a names-only company laborer list", () => {
  assert.match(source, /supabase\.rpc\("list_daily_job_cost_employees"\)/);
  assert.match(source, /canManageEmployeeWages, canUpdateDailyJobCostData/);
  assert.match(employeeDirectoryMigration, /public\.is_daily_job_cost_editor\(\)/);
  assert.match(employeeDirectoryMigration, /employee\.display_name/);
  const returnedColumns = employeeDirectoryMigration.match(/RETURNS TABLE \(([\s\S]*?)\)\s*LANGUAGE/i)?.[1] || "";
  assert.doesNotMatch(returnedColumns, /\b(hourly_rate|phone|email|payroll_id|notes)\b/i);
});

test("active job details open the shared daily job cost workflow", () => {
  assert.match(source, /onClick=\{\(\) => openApprovedJobDetail\(project\)\}>[\s\S]*?Update Daily Job Cost/);
});

test("successful daily progress saves confirm success and minimize saved days", () => {
  assert.match(source, /setSessionMessage\("Saved"\);\s*setCollapsedApprovedDailyProgressDayIds\(getDailyProgressDayIds\(approvedDailyProgressLogs\)\)/);
  assert.match(source, /role="status" aria-live="polite"[\s\S]*?>Saved<\/strong>/);
});
