import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("dashboard Collect Lead card opens a fresh CRM lead form", () => {
  assert.match(source, /const openDashboardLeadCapture = \(\) => \{[\s\S]*?startNewCrmLeadDraft\(\);[\s\S]*?setActiveTemplate\("crm"\);[\s\S]*?\};/);
  assert.match(source, /collectLead: \{[\s\S]*?title: "Collect Lead"[\s\S]*?open: openDashboardLeadCapture/);
  assert.match(source, /dashboardWorkspace\.actions\.map/);
});

test("office staff can route an inspection caller to Ivan from quick capture", () => {
  assert.match(source, /sendInspection: \{[\s\S]*?title: "Send for Inspection"[\s\S]*?open: openDashboardInspectionRequest/);
  assert.match(source, /leadStatus: "Inspection Requested"/);
  assert.match(source, /p_assignee_id: ivan\.id/);
  assert.match(source, /create_inspection_request_task/);
});
