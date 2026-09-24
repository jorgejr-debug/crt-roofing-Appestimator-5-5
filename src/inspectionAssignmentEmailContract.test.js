import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const emailFunction = fs.readFileSync(
  new URL("../supabase/functions/send-task-assignment-email/index.ts", import.meta.url),
  "utf8",
);

test("sending a lead for inspection queues Ivan's task and email notification", () => {
  assert.match(app, /create_private_company_task/);
  assert.match(app, /His task and email notification were queued/);
});

test("inspection assignments receive a privacy-safe dedicated email", () => {
  assert.match(emailFunction, /isInspectionAssignment/);
  assert.match(emailFunction, /Customer waiting to schedule a roof inspection/);
  assert.match(emailFunction, /New roof inspection request/);
  assert.match(emailFunction, /A customer is waiting for you to contact them and schedule their roof inspection/);
  assert.match(emailFunction, /Open Inspection Task/);
});
