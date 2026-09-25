import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("./TpoWorkspace.jsx", import.meta.url), "utf8");

test("the TPO estimator is excluded from the initial application bundle", () => {
  assert.match(appSource, /const TpoWorkspace = React\.lazy\(\(\) => import\("\.\/TpoWorkspace\.jsx"\)\)/);
  assert.doesNotMatch(appSource, /Build the estimate in the same order the job is scoped, priced, and bid\./);
  assert.match(workspaceSource, /Build the estimate in the same order the job is scoped, priced, and bid\./);
  assert.match(workspaceSource, /renderQuickMeasureReviewPanel/);
  assert.match(workspaceSource, /TravelCalculator/);
  assert.match(workspaceSource, /handleSaveEstimate/);
  assert.match(workspaceSource, /handleConvertCurrentEstimateToProposal/);
  assert.match(workspaceSource, /handleDownloadEstimatePDF/);
});

test("the extracted TPO workspace remains behind shared loading and recovery UI", () => {
  assert.match(appSource, /<WorkspaceErrorBoundary key=\{activeTemplate\}/);
  assert.match(appSource, /<React\.Suspense fallback=\{/);
  assert.match(appSource, /<TpoWorkspace[\s\S]*?workspace=\{\{/);
  assert.match(workspaceSource, /Missing Scope Checklist/);
});
