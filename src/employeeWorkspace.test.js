import assert from "node:assert/strict";
import test from "node:test";
import { getEmployeeAllowedTemplates, getEmployeeDashboardSections, getEmployeeNavigationKeys, getEmployeeWorkspace } from "./employeeWorkspace.js";

const allCapabilities = {
  canAccessInvoices: true,
  canAccessFinance: true,
  canViewApprovedJobs: true,
};

test("Chris receives a lead-generation workspace", () => {
  const workspace = getEmployeeWorkspace({ email: "chris@crtroofing.com", role: "salesperson", capabilities: allCapabilities });
  assert.equal(workspace.title, "Business Development");
  assert.deepEqual(workspace.actions, ["collectLead", "sendInspection", "customers", "tasks"]);
});

test("Ivan receives an inspection and estimating handoff workspace", () => {
  const workspace = getEmployeeWorkspace({ email: "ivan@crtroofing.com", role: "salesperson", capabilities: allCapabilities });
  assert.deepEqual(workspace.actions, ["inspections", "proposalRequests", "estimates", "customers", "tasks"]);
});

test("Daniela receives a proposal-delivery workspace", () => {
  const workspace = getEmployeeWorkspace({ email: "daniela@crtroofing.com", role: "estimator", capabilities: allCapabilities });
  assert.deepEqual(workspace.actions, ["proposalRequests", "tasks", "customers", "approvedJobs"]);
});

test("Miguel receives a production-only workspace", () => {
  const workspace = getEmployeeWorkspace({ email: "miguel@crtroofing.com", role: "project_manager", capabilities: allCapabilities });
  assert.deepEqual(workspace.actions, ["activeJobs", "fieldOperations", "tasks", "vendors"]);
});

test("Natalia receives the office and accounting workspace when authorized", () => {
  const workspace = getEmployeeWorkspace({ email: "natalia@crtroofing.com", role: "admin", capabilities: allCapabilities });
  assert.deepEqual(workspace.actions, ["invoices", "vendors", "tasks", "finance"]);
});

test("capability checks remove financial shortcuts even if a role configuration names them", () => {
  const workspace = getEmployeeWorkspace({ email: "natalia@crtroofing.com", role: "admin" });
  assert.deepEqual(workspace.actions, ["vendors", "tasks"]);
});

test("navigation follows each employee's SOP instead of showing every module", () => {
  assert.deepEqual(getEmployeeNavigationKeys({ email: "chris@crtroofing.com", role: "salesperson", capabilities: allCapabilities }), ["dashboard", "workHub", "inspectionRequests", "crm", "proposalRequests"]);
  assert.deepEqual(getEmployeeNavigationKeys({ email: "ivan@crtroofing.com", role: "salesperson", capabilities: allCapabilities }), ["dashboard", "workHub", "inspectionRequests", "crm", "fieldNotes", "estimateTemplates", "proposalRequests", "approvedJobs"]);
  assert.deepEqual(getEmployeeNavigationKeys({ email: "daniela@crtroofing.com", role: "estimator", capabilities: allCapabilities }), ["dashboard", "workHub", "inspectionRequests", "crm", "proposalRequests", "approvedJobs", "activeJobs"]);
  assert.deepEqual(getEmployeeNavigationKeys({ email: "miguel@crtroofing.com", role: "project_manager", capabilities: allCapabilities }), ["dashboard", "workHub", "kpis", "activeJobs", "subcontractors"]);
});

test("financial navigation remains capability-gated", () => {
  const keys = getEmployeeNavigationKeys({ email: "natalia@crtroofing.com", role: "admin" });
  assert.equal(keys.includes("invoices"), false);
  assert.equal(keys.includes("cfoDashboard"), false);
});

test("employee SOP access blocks hidden workspaces while preserving required detail screens", () => {
  const chrisTemplates = getEmployeeAllowedTemplates({ email: "chris@crtroofing.com", role: "salesperson", capabilities: allCapabilities });
  assert.equal(chrisTemplates.includes("crm"), true);
  assert.equal(chrisTemplates.includes("cfoDashboard"), false);
  assert.equal(chrisTemplates.includes("administration"), false);

  const ivanTemplates = getEmployeeAllowedTemplates({ email: "ivan@crtroofing.com", role: "salesperson", capabilities: allCapabilities });
  assert.equal(ivanTemplates.includes("sprayFoam"), true);
  assert.equal(ivanTemplates.includes("approvedJob"), true);
  assert.equal(ivanTemplates.includes("invoices"), false);

  const miguelTemplates = getEmployeeAllowedTemplates({ email: "miguel@crtroofing.com", role: "project_manager", capabilities: allCapabilities });
  assert.equal(miguelTemplates.includes("activeJob"), true);
  assert.equal(miguelTemplates.includes("approvedJob"), true);
  assert.equal(miguelTemplates.includes("crm"), false);
  assert.equal(miguelTemplates.includes("adminPricing"), false);
});

test("executive management keeps complete app access", () => {
  assert.equal(getEmployeeAllowedTemplates({ email: "jorgejr@crtroofing.com", role: "cfo", capabilities: allCapabilities }), null);
});

test("dashboard job lists follow operational responsibility", () => {
  assert.deepEqual(getEmployeeDashboardSections({ email: "chris@crtroofing.com", role: "salesperson" }), {
    activeJobs: false, completedJobs: false, archivedJobs: false, approvedJobs: false, savedEstimates: false,
  });
  assert.deepEqual(getEmployeeDashboardSections({ email: "ivan@crtroofing.com", role: "salesperson" }), {
    activeJobs: false, completedJobs: false, archivedJobs: false, approvedJobs: true, savedEstimates: true,
  });
  assert.deepEqual(getEmployeeDashboardSections({ email: "miguel@crtroofing.com", role: "project_manager" }), {
    activeJobs: true, completedJobs: false, archivedJobs: false, approvedJobs: false, savedEstimates: false,
  });
});

test("management retains the complete operational dashboard history", () => {
  assert.deepEqual(getEmployeeDashboardSections({ email: "jorgejr@crtroofing.com", role: "cfo" }), {
    activeJobs: true, completedJobs: true, archivedJobs: true, approvedJobs: true, savedEstimates: true,
  });
});
