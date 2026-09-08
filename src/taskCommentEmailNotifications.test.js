import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260828203000_task_comment_email_notifications.sql", import.meta.url),
  "utf8",
);
const emailFunction = fs.readFileSync(
  new URL("../supabase/functions/send-task-assignment-email/index.ts", import.meta.url),
  "utf8",
);

test("task comments notify the creator and assignees except the commenter", () => {
  assert.match(migration, /AFTER INSERT ON public\.company_task_comments/);
  assert.match(migration, /SELECT task\.created_by AS user_id[\s\S]*?UNION[\s\S]*?SELECT assignee\.user_id/);
  assert.match(migration, /WHERE recipient\.user_id <> NEW\.author_id/);
  assert.match(migration, /source_comment_id, user_id/);
});

test("task email function sends a dedicated escaped comment email", () => {
  assert.match(emailFunction, /notification_type === "comment"/);
  assert.match(emailFunction, /New comment on task:/);
  assert.match(emailFunction, /escapeHtml\(commentResult\.data\?\.body/);
  assert.match(emailFunction, /Open Task Discussion/);
});
