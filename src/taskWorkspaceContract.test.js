import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workHubSource = readFileSync(new URL("./WorkHub.jsx", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("./DashboardTasks.jsx", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../supabase/migrations/20260910173000_task_workspace_statuses.sql", import.meta.url), "utf8");

test("task workspace exposes compact filters and recoverable history", () => {
  assert.match(workHubSource, /New Task/);
  assert.match(workHubSource, /Past due/);
  assert.match(workHubSource, /Completed history/);
  assert.match(workHubSource, /Voided history/);
  assert.match(workHubSource, /Payment follow-ups/);
});

test("opening a task marks only that task's notifications read", () => {
  assert.match(workHubSource, /\.eq\("task_id", taskId\)\.is\("read_at", null\)/);
  assert.match(dashboardSource, /\.eq\("task_id", taskId\)\.is\("read_at", null\)/);
  assert.doesNotMatch(dashboardSource, /\.eq\("user_id", authUserKey\)\.is\("read_at", null\);/);
});

test("voided tasks are stored as history without weakening RLS", () => {
  assert.match(migrationSource, /'completed', 'voided'/);
  assert.match(migrationSource, /Past due is derived from due_date/i);
  assert.doesNotMatch(migrationSource, /DISABLE ROW LEVEL SECURITY/i);
  assert.doesNotMatch(migrationSource, /CREATE POLICY/i);
});
