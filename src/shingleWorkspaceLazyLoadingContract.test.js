import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("./ShingleWorkspace.jsx", import.meta.url), "utf8");

test("the Shingle estimator is excluded from the initial application bundle", () => {
  assert.match(appSource, /const ShingleWorkspace = React\.lazy\(\(\) => import\("\.\/ShingleWorkspace\.jsx"\)\)/);
  assert.doesNotMatch(appSource, /Shingle template with measurements, material takeoff, labor, travel, and markup totals\./);
  assert.match(workspaceSource, /Shingle template with measurements, material takeoff, labor, travel, and markup totals\./);
  assert.match(workspaceSource, /renderQuickMeasureReviewPanel/);
  assert.match(workspaceSource, /TravelCalculator/);
  assert.match(workspaceSource, /handleSaveEstimate/);
  assert.match(workspaceSource, /handleConvertCurrentEstimateToProposal/);
  assert.match(workspaceSource, /handleDownloadEstimatePDF/);
});

test("the extracted Shingle workspace remains behind shared loading and recovery UI", () => {
  assert.match(appSource, /<WorkspaceErrorBoundary key=\{activeTemplate\}/);
  assert.match(appSource, /<React\.Suspense fallback=\{/);
  assert.match(appSource, /<ShingleWorkspace[\s\S]*?workspace=\{\{/);
  assert.match(workspaceSource, /<Section title="Subcontractor"/);
  assert.match(workspaceSource, /<Section title="Labor"/);
});
