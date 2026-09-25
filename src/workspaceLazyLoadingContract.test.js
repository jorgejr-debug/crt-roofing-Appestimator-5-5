import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("specialist workspaces are excluded from the initial application bundle", () => {
  assert.doesNotMatch(source, /^import WorkHub from/m);
  assert.doesNotMatch(source, /^import InvoiceQueue from/m);
  assert.doesNotMatch(source, /^import AccountAccessVault from/m);
  assert.doesNotMatch(source, /^import SubcontractorCompliance from/m);
  assert.match(source, /const WorkHub = React\.lazy\(\(\) => import\("\.\/WorkHub\.jsx"\)\)/);
  assert.match(source, /const InvoiceQueue = React\.lazy\(\(\) => import\("\.\/InvoiceQueue\.jsx"\)\)/);
  assert.match(source, /const AccountAccessVault = React\.lazy\(\(\) => import\("\.\/AccountAccessVault\.jsx"\)\)/);
  assert.match(source, /const SubcontractorCompliance = React\.lazy\(\(\) => import\("\.\/SubcontractorCompliance\.jsx"\)\)/);
});

test("lazy workspaces retain the portal and show an accessible loading state", () => {
  assert.match(source, /<React\.Suspense fallback=/);
  assert.match(source, /aria-live="polite" aria-busy="true"/);
  assert.match(source, /Opening workspace…/);
});

test("failed workspace downloads provide recovery instead of a blank screen", () => {
  assert.match(source, /class WorkspaceErrorBoundary extends React\.Component/);
  assert.match(source, /static getDerivedStateFromError/);
  assert.match(source, /<WorkspaceErrorBoundary key=\{activeTemplate\}/);
  assert.match(source, /This workspace could not open/);
  assert.match(source, /window\.location\.reload\(\)/);
  assert.match(source, /Return to Dashboard/);
  assert.match(source, /Your saved company records were not changed/);
});
