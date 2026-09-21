import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInspectionTask,
  businessMinutesBetween,
  calculateDanielaKpis,
  calculateIvanKpis,
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

test("business time excludes nights and weekends", () => {
  assert.equal(
    businessMinutesBetween("2026-09-18T16:00:00-07:00", "2026-09-21T10:00:00-07:00"),
    180,
  );
});

test("Ivan KPI separates supplied capacity from controllable execution and quality", () => {
  const ivanId = "ivan-id";
  const leads = [
    {
      id: "lead-1",
      assignedStaffId: ivanId,
      leadStatus: "Estimate in Progress",
      history: [
        { label: "Sent for inspection", createdAt: "2026-09-14T08:00:00-07:00" },
        { label: "Contacted", createdAt: "2026-09-14T09:00:00-07:00" },
        { label: "Inspection Completed", createdAt: "2026-09-14T15:00:00-07:00" },
      ],
      lastActivityDate: "2026-09-14T15:00:00-07:00",
    },
    {
      id: "lead-2",
      assignedStaffId: ivanId,
      leadStatus: "Appointment Scheduled",
      history: [
        { label: "Sent for inspection", createdAt: "2026-09-15T08:00:00-07:00" },
        { label: "Contacted", createdAt: "2026-09-15T12:00:00-07:00" },
      ],
      lastActivityDate: "2026-09-15T12:00:00-07:00",
    },
  ];
  const requests = [{
    source_lead_id: "lead-1",
    salesperson_id: ivanId,
    status: "under_review",
    submitted_at: "2026-09-15T11:00:00-07:00",
    missing_information_count: 0,
  }];
  const kpis = calculateIvanKpis(leads, requests, {
    now: new Date("2026-09-16T12:00:00-07:00"),
    ivanUserId: ivanId,
    weeklyInspectionTarget: 6,
  });

  assert.equal(kpis.assignedThisWeek, 2);
  assert.equal(kpis.capacityCoverage, 2 / 6);
  assert.equal(kpis.completedThisWeek, 1);
  assert.equal(kpis.executionRate, 1 / 2);
  assert.equal(kpis.contactOnTime, 1);
  assert.equal(kpis.contactEligible, 2);
  assert.equal(kpis.handoffOnTime, 1);
  assert.equal(kpis.handoffStatus, "green");
  assert.equal(kpis.submittedAfterInspection, 1);
  assert.equal(kpis.availableCapacity, 4);
  assert.equal(kpis.acceptedFirstPass, 1);
  assert.equal(kpis.staleCount, 0);
  assert.equal(Number.isFinite(kpis.overallScore), true);
});

test("Daniela KPI scores controllable proposal work and excludes paused requests", () => {
  const requests = [
    { id: "r1", assigned_estimator_id: "daniela", status: "sales_review", submitted_at: "2026-09-01T08:00:00-07:00", target_completion_at: "2026-09-02T08:00:00-07:00", sla_paused_seconds: 0, missing_information_count: 0 },
    { id: "r2", assigned_estimator_id: "daniela", status: "drafting_proposal", submitted_at: "2026-09-03T08:00:00-07:00", target_completion_at: "2026-09-04T08:00:00-07:00", sla_paused_seconds: 0, missing_information_count: 0 },
    { id: "r3", assigned_estimator_id: "daniela", status: "missing_information", submitted_at: "2026-09-04T08:00:00-07:00", target_completion_at: "2026-09-05T08:00:00-07:00", sla_paused_at: "2026-09-04T09:00:00-07:00", missing_information_count: 1 },
  ];
  const versions = [{ id: "v1", proposal_request_id: "r1", finalized_at: "2026-09-01T16:00:00-07:00", source_document_storage_path: "r1/proposal.docx", final_pdf_storage_path: "r1/proposal.pdf" }];
  const audit = [
    { proposal_request_id: "r1", action: "assigned", created_at: "2026-09-01T09:00:00-07:00" },
    { proposal_request_id: "r2", action: "assigned", created_at: "2026-09-03T13:00:00-07:00" },
    { proposal_request_id: "r3", action: "information_requested", created_at: "2026-09-04T09:00:00-07:00" },
  ];
  const kpis = calculateDanielaKpis(requests, versions, audit, {
    now: new Date("2026-09-08T12:00:00-07:00"),
    danielaUserId: "daniela",
    periodDays: 30,
  });

  assert.equal(kpis.submittedCount, 3);
  assert.equal(kpis.intakeOnTime, 2);
  assert.equal(kpis.intakeEligible, 3);
  assert.equal(kpis.turnaroundOnTime, 1);
  assert.equal(kpis.turnaroundEligible, 2);
  assert.equal(kpis.completeHandoffs, 1);
  assert.equal(kpis.activeQueueCount, 1);
  assert.equal(kpis.overdueCount, 1);
  assert.equal(kpis.missingInformationCount, 1);
  assert.equal(Number.isFinite(kpis.overallScore), true);
});

test("Chris KPI scorecard measures weekly supply, qualification, capacity, and stale work", () => {
  const now = new Date("2026-09-18T12:00:00Z");
  const leads = [
    { originatorEmail: "chris@crtroofing.com", leadSource: "Cold Calling", createdAt: "2026-09-15T12:00:00Z", qualificationStatus: "qualified", acceptedForInspectionAt: "2026-09-16T12:00:00Z", lastActivityDate: "2026-09-16T12:00:00Z", leadStatus: "Contacted" },
    { originatorEmail: "chris@crtroofing.com", leadSource: "Cold Calling", createdAt: "2026-09-17T12:00:00Z", qualificationStatus: "captured", lastActivityDate: "2026-09-17T12:00:00Z", leadStatus: "New" },
    { originatorEmail: "chris@crtroofing.com", createdAt: "2026-08-01T12:00:00Z", qualificationStatus: "captured", lastActivityDate: "2026-08-02T12:00:00Z", leadStatus: "Contacted" },
    { originatorEmail: "ivan@crtroofing.com", createdAt: "2026-09-17T12:00:00Z", qualificationStatus: "qualified" },
  ];
  const kpis = calculateLeadKpis(leads, { now, originatorEmail: "chris@crtroofing.com", weeklyInspectionTarget: 4 });
  assert.equal(kpis.capturedThisWeek, 2);
  assert.equal(kpis.customerVisitsThisWeek, 2);
  assert.equal(kpis.qualifiedThisWeek, 1);
  assert.equal(kpis.inspectionReadyThisWeek, 1);
  assert.equal(kpis.capacityCoverage, 0.25);
  assert.equal(kpis.staleCount, 1);
});

test("Chris KPI weights the 36 visit, 6 qualified lead, and 4 inspection weekly funnel", () => {
  const leads = Array.from({ length: 36 }, (_, index) => ({
    id: `visit-${index + 1}`,
    originatorEmail: "chris@crtroofing.com",
    leadSource: "Cold Calling",
    visitOutcome: index < 4 ? "inspection" : index < 6 ? "qualified" : "no_contact",
    qualificationStatus: index < 6 ? "qualified" : "captured",
    acceptedForInspectionAt: index < 4 ? "2026-09-22T12:00:00Z" : "",
    createdAt: "2026-09-22T10:00:00Z",
    lastActivityDate: "2026-09-22T12:00:00Z",
    leadStatus: index < 4 ? "Inspection Requested" : "New",
  }));
  const kpis = calculateLeadKpis(leads, {
    now: new Date("2026-09-23T12:00:00Z"),
    originatorEmail: "chris@crtroofing.com",
    weeklyInspectionTarget: 6,
  });

  assert.equal(kpis.customerVisitsThisWeek, 36);
  assert.equal(kpis.qualifiedThisWeek, 6);
  assert.equal(kpis.inspectionReadyThisWeek, 4);
  assert.equal(kpis.qualificationRate, 1 / 6);
  assert.equal(kpis.weeklyScore, 100);
  assert.equal(kpis.qualifiedStatus, "green");
});

test("Chris field-visit KPI excludes office phone leads", () => {
  const kpis = calculateLeadKpis([
    { originatorEmail: "chris@crtroofing.com", leadSource: "Cold Calling", createdAt: "2026-09-22T10:00:00Z" },
    { originatorEmail: "chris@crtroofing.com", leadSource: "Phone Call / Office", createdAt: "2026-09-22T11:00:00Z", qualificationStatus: "qualified" },
  ], {
    now: new Date("2026-09-23T12:00:00Z"),
    originatorEmail: "chris@crtroofing.com",
  });

  assert.equal(kpis.capturedThisWeek, 2);
  assert.equal(kpis.customerVisitsThisWeek, 1);
  assert.equal(kpis.qualifiedThisWeek, 0);
});
