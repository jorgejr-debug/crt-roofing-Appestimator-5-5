import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("dashboard Collect Lead card opens a fresh CRM lead form", () => {
  assert.match(source, /const openDashboardLeadCapture = \(\) => \{[\s\S]*?startNewCrmLeadDraft\(\);[\s\S]*?setActiveTemplate\("crm"\);[\s\S]*?\};/);
  assert.match(source, /<strong>Collect Lead<\/strong>/);
  assert.match(source, /onClick=\{openDashboardLeadCapture\}/);
});
