import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("./SprayFoamWorkspace.jsx", import.meta.url), "utf8");

test("the Spray Foam estimator is excluded from the initial application bundle", () => {
  assert.match(appSource, /const SprayFoamWorkspace = React\.lazy\(\(\) => import\("\.\/SprayFoamWorkspace\.jsx"\)\)/);
  assert.doesNotMatch(appSource, /Squares-based spray foam template with material, labor, travel, and markup totals\./);
  assert.match(workspaceSource, /title: "Spray Foam Estimate"/);
  assert.match(workspaceSource, /TravelCalculator/);
  assert.match(workspaceSource, /handleSaveEstimate/);
  assert.match(workspaceSource, /handleConvertCurrentEstimateToProposal/);
  assert.match(workspaceSource, /handleDownloadEstimatePDF/);
});

test("the extracted Spray Foam workspace remains behind the shared recovery boundary", () => {
  assert.match(appSource, /<WorkspaceErrorBoundary key=\{activeTemplate\}/);
  assert.match(appSource, /<React\.Suspense fallback=\{/);
  assert.match(appSource, /<SprayFoamWorkspace[\s\S]*?workspace=\{\{/);
});
