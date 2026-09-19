import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInspectionTask,
  calculateLeadKpis,
  findInspectionAssignee,
  findPotentialDuplicateLead,
  validateQuickLead,
} from "./crmLeadWorkflow.js";

test("quick capture requires an identity and one contact route", () => {
  assert.equal(validateQuickLead({ contactName: "Acme Roofing", phone: "" }).valid, false);
  assert.equal(validateQuickLead({ companyName: "Acme", phone: "(909) 555-0100" }).valid, true);
  assert.equal(validateQuickLead({ contactName: "Jane", propertyAddress: "123 Main St" }).valid, true);
});

test("duplicate detection matches normalized phones or addresses", () => {
  const existing = [{ id: "1", phone: "(909) 555-0100", propertyAddress: "123 Main St" }];
  assert.equal(findPotentialDuplicateLead(existing, { id: "2", phone: "9095550100" })?.id, "1");
  assert.equal(findPotentialDuplicateLead(existing, { id: "2", propertyAddress: "123 main st" })?.id, "1");
});

test("inspection routing finds Ivan and builds a complete task", () => {
  const ivan = findInspectionAssignee([
    { id: "other", full_name: "Chris Hutchinson", email: "chris@crtroofing.com", role: "salesperson" },
    { id: "ivan-id", full_name: "Ivan Solano", email: "ivan@crtroofing.com", role: "estimator" },
  ]);
  assert.equal(ivan?.id, "ivan-id");

  const task = buildInspectionTask({
    contactName: "Jane Customer",
    phone: "(909) 555-0100",
    propertyAddress: "123 Main St",
    roofingServiceNeeded: "Roof inspection",
    description: "Office caller reported a leak.",
    originatorName: "Natalia",
    urgency: "High",
  });
  assert.equal(task.title, "Inspection Request: Jane Customer");
  assert.equal(task.priority, "high");
  assert.match(task.description, /Phone: \(909\) 555-0100/);
  assert.match(task.description, /Property address: 123 Main St/);
  assert.match(task.description, /Sent by: Natalia/);
});

test("Chris KPI scorecard measures weekly supply, qualification, capacity, and stale work", () => {
  const now = new Date("2026-09-18T12:00:00Z");
  const leads = [
    { originatorEmail: "chris@crtroofing.com", createdAt: "2026-09-15T12:00:00Z", qualificationStatus: "qualified", acceptedForInspectionAt: "2026-09-16T12:00:00Z", lastActivityDate: "2026-09-16T12:00:00Z", leadStatus: "Contacted" },
    { originatorEmail: "chris@crtroofing.com", createdAt: "2026-09-17T12:00:00Z", qualificationStatus: "captured", lastActivityDate: "2026-09-17T12:00:00Z", leadStatus: "New" },
    { originatorEmail: "chris@crtroofing.com", createdAt: "2026-08-01T12:00:00Z", qualificationStatus: "captured", lastActivityDate: "2026-08-02T12:00:00Z", leadStatus: "Contacted" },
    { originatorEmail: "ivan@crtroofing.com", createdAt: "2026-09-17T12:00:00Z", qualificationStatus: "qualified" },
  ];
  const kpis = calculateLeadKpis(leads, { now, originatorEmail: "chris@crtroofing.com", weeklyInspectionTarget: 4 });
  assert.equal(kpis.capturedThisWeek, 2);
  assert.equal(kpis.qualifiedThisWeek, 1);
  assert.equal(kpis.inspectionReadyThisWeek, 1);
  assert.equal(kpis.capacityCoverage, 0.25);
  assert.equal(kpis.staleCount, 1);
});
