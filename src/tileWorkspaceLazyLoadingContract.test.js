import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("./TileWorkspace.jsx", import.meta.url), "utf8");

test("the Tile estimator is excluded from the initial application bundle", () => {
  assert.match(appSource, /const TileWorkspace = React\.lazy\(\(\) => import\("\.\/TileWorkspace\.jsx"\)\)/);
  assert.doesNotMatch(appSource, /Tile estimate built in the same layout and workflow as the Shingle screen\./);
  assert.match(workspaceSource, /Tile estimate built in the same layout and workflow as the Shingle screen\./);
  assert.match(workspaceSource, /renderQuickMeasureReviewPanel/);
  assert.match(workspaceSource, /TravelCalculator/);
  assert.match(workspaceSource, /handleSaveEstimate/);
  assert.match(workspaceSource, /handleConvertCurrentEstimateToProposal/);
  assert.match(workspaceSource, /handleDownloadEstimatePDF/);
});

test("the extracted Tile workspace remains behind shared loading and recovery UI", () => {
  assert.match(appSource, /<WorkspaceErrorBoundary key=\{activeTemplate\}/);
  assert.match(appSource, /<React\.Suspense fallback=\{/);
  assert.match(appSource, /<TileWorkspace[\s\S]*?workspace=\{\{/);
  assert.match(workspaceSource, /<Section title="Tile Material Calculations"/);
  assert.match(workspaceSource, /<Section title="Labor"/);
});
