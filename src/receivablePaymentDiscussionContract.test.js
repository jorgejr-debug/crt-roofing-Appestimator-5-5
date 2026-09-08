import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const workHubSource = readFileSync(new URL("./WorkHub.jsx", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("../supabase/migrations/20260904120000_receivable_payment_followup_threads.sql", import.meta.url),
  "utf8",
);

test("overdue receivables open their linked Natalia discussion", () => {
  assert.match(appSource, /paymentStatus === "Overdue"/);
  assert.match(appSource, /Ask Natalia \/ Discussion/);
  assert.match(appSource, /get_or_create_receivable_payment_followup/);
  assert.match(appSource, /initialTaskId=\{workHubInitialTaskId\}/);
});

test("Tasks & Messages opens the requested task discussion", () => {
  assert.match(workHubSource, /initialTaskId = ""/);
  assert.match(workHubSource, /useState\(initialTaskId \? "tasks" : initialTab\)/);
  assert.match(workHubSource, /useState\(initialTaskId\)/);
});

test("payment follow-up creation is private, finance-only, and idempotent", () => {
  assert.match(migrationSource, /caller_role NOT IN \('admin', 'cfo'\)/);
  assert.match(migrationSource, /receivable_payment_follow_up/);
  assert.match(migrationSource, /company_tasks_receivable_followup_unique/);
  assert.match(migrationSource, /natalia@crtroofing\.com/);
  assert.match(migrationSource, /company_task_assignees/);
  assert.match(migrationSource, /ON CONFLICT \(task_id, user_id\) DO NOTHING/);
  assert.match(migrationSource, /lower\(coalesce\(financial\.status, ''\)\) <> 'paid'/);
});
