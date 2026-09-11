import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const attentionSource = readFileSync(new URL("./DashboardTasks.jsx", import.meta.url), "utf8");
const workHubSource = readFileSync(new URL("./WorkHub.jsx", import.meta.url), "utf8");

test("dashboard starts with a focused attention center and role-aware quick actions", () => {
  assert.match(attentionSource, /Attention Center/);
  assert.match(attentionSource, /Past-due tasks/);
  assert.match(attentionSource, /Proposal actions/);
  assert.match(attentionSource, /Open job issues/);
  assert.match(appSource, /canAccessInvoices=\{canAccessInvoiceQueue\}/);
  assert.match(appSource, /canManageCompliance=\{canManageSubcontractorCompliance\}/);
  assert.match(appSource, /<strong>New Task<\/strong>/);
  assert.match(appSource, /<strong>Proposal Request<\/strong>/);
});

test("secondary dashboard lists are minimized without removing their workspaces", () => {
  assert.match(appSource, /useState\(true\);\n\s*const \[archivedJobsCollapsed/);
  assert.match(appSource, /dashboardCompletedJobsOpen/);
  assert.match(appSource, /dashboardToolsOpen/);
  assert.match(appSource, /Showing the next/);
  assert.match(appSource, /setActiveTemplate\("activeJobs"\)/);
  assert.match(appSource, /setActiveTemplate\("approvedJobs"\)/);
});

test("New Task quick action opens the existing task creator", () => {
  assert.match(appSource, /setWorkHubInitialCreateTask\(true\)/);
  assert.match(appSource, /initialCreateTask=\{workHubInitialCreateTask\}/);
  assert.match(workHubSource, /useState\(Boolean\(initialCreateTask\)\)/);
});
