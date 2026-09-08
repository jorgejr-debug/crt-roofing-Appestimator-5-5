import test from "node:test";
import assert from "node:assert/strict";
import { TASK_DELETE_CONFIRMATION, canDeleteTask } from "./taskDeletion.js";

test("only the task creator receives the delete action", () => {
  const task = { id: "task-1", created_by: "creator-1" };
  assert.equal(canDeleteTask(task, "creator-1"), true);
  assert.equal(canDeleteTask(task, "assignee-1"), false);
  assert.equal(canDeleteTask(null, "creator-1"), false);
});

test("task deletion warning clearly states that deletion is irreversible", () => {
  assert.match(TASK_DELETE_CONFIRMATION, /Are you sure/i);
  assert.match(TASK_DELETE_CONFIRMATION, /won't be able to access/i);
});
