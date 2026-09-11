import test from "node:test";
import assert from "node:assert/strict";
import { isTaskClosed, isTaskPastDue, taskMatchesView, taskStatusLabel, taskType, taskTypeLabel } from "./taskStatus.js";

const today = new Date(2026, 8, 10, 12, 0, 0);

test("past due is automatic and never overrides a closed status", () => {
  assert.equal(isTaskPastDue({ status: "open", due_date: "2026-09-09" }, today), true);
  assert.equal(taskStatusLabel({ status: "open", due_date: "2026-09-09" }, today), "Past Due");
  assert.equal(isTaskPastDue({ status: "completed", due_date: "2026-09-09" }, today), false);
  assert.equal(taskStatusLabel({ status: "completed", due_date: "2026-09-09" }, today), "Completed");
});

test("working status has a clear user-facing label", () => {
  assert.equal(taskStatusLabel({ status: "in_progress" }, today), "Working on It");
});

test("active view excludes completed and voided tasks while history retains them", () => {
  assert.equal(isTaskClosed({ status: "open" }), false);
  assert.equal(isTaskClosed({ status: "completed" }), true);
  assert.equal(isTaskClosed({ status: "voided" }), true);
  assert.equal(taskMatchesView({ status: "completed" }, "active", today), false);
  assert.equal(taskMatchesView({ status: "voided" }, "active", today), false);
  assert.equal(taskMatchesView({ status: "completed" }, "completed", today), true);
  assert.equal(taskMatchesView({ status: "voided" }, "voided", today), true);
});

test("existing task relationships become useful type labels without duplicating systems", () => {
  assert.equal(taskType({ related_type: "receivable_payment_follow_up" }), "payment_follow_up");
  assert.equal(taskTypeLabel({ related_type: "receivable_payment_follow_up" }), "Payment Follow-up");
  assert.equal(taskType({ task_type: "proposal_request" }), "proposal_request");
  assert.equal(taskTypeLabel({ task_type: "proposal_request" }), "Proposal Request");
  assert.equal(taskTypeLabel({}), "General Task");
});
