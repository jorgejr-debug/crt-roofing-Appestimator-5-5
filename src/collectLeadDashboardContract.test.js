import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("dashboard Collect Lead card opens a fresh CRM lead form", () => {
  assert.match(source, /const openDashboardLeadCapture = \(\) => \{[\s\S]*?startNewCrmLeadDraft\(\);[\s\S]*?setActiveTemplate\("crm"\);[\s\S]*?\};/);
  assert.match(source, /<strong>Collect Lead<\/strong>/);
  assert.match(source, /onClick=\{openDashboardLeadCapture\}/);
});

test("office staff can route an inspection caller to Ivan from quick capture", () => {
  assert.match(source, /<strong>Send for Inspection<\/strong>/);
  assert.match(source, /onClick=\{openDashboardInspectionRequest\}/);
  assert.match(source, /leadStatus: "Inspection Requested"/);
  assert.match(source, /p_assignee_ids: \[ivan\.id\]/);
  assert.match(source, /create_private_company_task/);
});
