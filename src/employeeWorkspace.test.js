import assert from "node:assert/strict";
import test from "node:test";
import { getEmployeeWorkspace } from "./employeeWorkspace.js";

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
