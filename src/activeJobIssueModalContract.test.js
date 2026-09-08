import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("dashboard renders the issue modal used by its Active Jobs preview button", () => {
  const modalDefinitionIndex = appSource.indexOf("const renderActiveJobIssueModal = () =>");
  assert.ok(modalDefinitionIndex > 0, "issue modal renderer should exist");

  const dashboardSource = appSource.slice(0, modalDefinitionIndex);
  assert.match(dashboardSource, /onClick=\{\(\) => openActiveJobIssueModal\(job\)\}/);
  assert.match(dashboardSource, /\{renderActiveJobIssueModal\(\)\}\s*\{renderInvoiceHandoffModal\(\)\}\s*<\/div>\s*\);\s*\}/);
});
