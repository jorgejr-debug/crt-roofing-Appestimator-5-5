import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("approved jobs page provides an authorized quick-entry form", () => {
  assert.match(source, /canCreateApprovedJobData \? \([\s\S]*?Add Approved Job[\s\S]*?\) : null/);
  assert.match(source, /approvedJobQuickCreateOpen \? \([\s\S]*?<Section title="Add Approved Job"/);
});
