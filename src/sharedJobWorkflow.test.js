import test from "node:test";
import assert from "node:assert/strict";
import {
  canUpdateDailyJobCosts,
  canCreateApprovedJobs,
  applyActiveJobEditDraft,
  buildCfoApprovedJobSharedJob,
  buildCfoApprovedJobsLedger,
  buildActiveJobEditDraft,
  buildSharedJobSourceId,
  buildSharedJobUpsertRow,
  canManageSharedJobs,
  getActiveJobPreviewDetails,
  inferWorkflowStatus,
  markActiveJobComplete,
  moveApprovedJobToActive,
  splitSharedJobsByWorkflow,
} from "./sharedJobWorkflow.js";

test("Daniela can update daily job costs without receiving full job-management access", () => {
  assert.equal(canUpdateDailyJobCosts("salesperson", "daniela@crtroofing.com"), true);
  assert.equal(canUpdateDailyJobCosts("salesperson", "chris@crtroofing.com"), false);
  assert.equal(canUpdateDailyJobCosts("cfo", "jorgejr@crtroofing.com"), true);
});

test("CFO approved totals use shared approved and active jobs without duplicates", () => {
  const approved = { id: "a", sourceRecordUid: "job:a", workflowStatus: "approved", projectName: "Approved", contractAmount: 12500, status: "Approved" };
  const active = { id: "b", sourceRecordUid: "job:b", workflowStatus: "active", projectName: "Active", finalBid: 7500, status: "In Progress" };
  const duplicate = { ...approved, projectName: "Newest Approved" };
  const completed = { id: "c", sourceRecordUid: "job:c", workflowStatus: "completed", contractAmount: 9000, status: "Completed" };
  const ledger = buildCfoApprovedJobsLedger([approved, active, duplicate, completed]);
  assert.equal(ledger.count, 2);
  assert.equal(ledger.total, 20000);
  assert.equal(ledger.entries.find((entry) => entry.id === "a").recordName, "Newest Approved");
});

test("Ivan can create approved jobs without receiving management access", () => {
  assert.equal(canCreateApprovedJobs("salesperson", "ivan@crtroofing.com"), true);
  assert.equal(canCreateApprovedJobs("salesperson", "another.employee@crtroofing.com"), false);
  assert.equal(canManageSharedJobs("salesperson"), false);
});

test("CFO approved-job entries map to the shared dashboard job model", () => {
  const job = buildCfoApprovedJobSharedJob({
    id: "entry-22",
    recordName: "CR-220 / Oak Street Roof",
    amount: "$125,500.00",
    recordDate: "2026-08-24",
    status: "Ready to schedule",
    note: "Signed contract",
  });

  assert.equal(job.sourceRecordUid, "job:cfo-approved:entry-22");
  assert.equal(job.projectName, "CR-220 / Oak Street Roof");
  assert.equal(job.contractAmount, 125500);
  assert.equal(job.approvalDate, "2026-08-24");
  assert.equal(job.workflowStatus, "approved");
});

test("permissions allow only admin/cfo to manage shared jobs", () => {
  assert.equal(canManageSharedJobs("admin"), true);
  assert.equal(canManageSharedJobs("cfo"), true);
  assert.equal(canManageSharedJobs("salesperson"), false);
  assert.equal(canManageSharedJobs("estimator"), false);
});

test("workflow status is centrally derived from status field", () => {
  assert.equal(inferWorkflowStatus({ status: "Scheduled" }), "active");
  assert.equal(inferWorkflowStatus({ projectStatus: "Pre-construction" }), "active");
  assert.equal(inferWorkflowStatus({ projectStatus: "Ready to schedule" }), "approved");
  assert.equal(inferWorkflowStatus({ status: "Completed" }), "completed");
});

test("shared source id stays stable for same job", () => {
  const id1 = buildSharedJobSourceId({ estimateId: "est-11" });
  const id2 = buildSharedJobSourceId({ estimateId: "est-11" });
  assert.equal(id1, id2);
  assert.equal(buildSharedJobSourceId({ sourceRecordUid: id1 }), id1);
});

test("archived jobs remain available separately from active workflow lists", () => {
  const archivedRow = buildSharedJobUpsertRow(
    { id: "job-archive-1", status: "In Progress", workflowStatus: "archived" },
    "user-1",
    "editor",
  );
  const split = splitSharedJobsByWorkflow([archivedRow]);
  assert.equal(split.activeJobs.length, 0);
  assert.equal(split.approvedJobs.length, 0);
  assert.equal(split.archivedJobs.length, 1);
  assert.equal(split.archivedJobs[0].id, "job-archive-1");
});

test("shared rows dedupe by source and keep newest update", () => {
  const oldRow = buildSharedJobUpsertRow(
    { id: "job-11", projectName: "Old Name", status: "Ready to schedule" },
    "user-1",
    "editor-1",
  );
  oldRow.updated_at = "2026-08-18T10:00:00.000Z";
  oldRow.job_payload.projectName = "Old Name";

  const newRow = buildSharedJobUpsertRow(
    { id: "job-11", projectName: "New Name", status: "Ready to schedule" },
    "user-2",
    "editor-2",
  );
  newRow.updated_at = "2026-08-18T11:00:00.000Z";
  newRow.job_payload.projectName = "New Name";

  const split = splitSharedJobsByWorkflow([oldRow, newRow]);
  assert.equal(split.approvedJobs.length, 1);
  assert.equal(split.approvedJobs[0].projectName, "New Name");
});

test("status transition moves job from approved to active", () => {
  const approvedRow = buildSharedJobUpsertRow({ id: "job-77", status: "Ready to schedule" }, "user-1", "editor");
  approvedRow.updated_at = "2026-08-18T10:00:00.000Z";

  const activeRow = buildSharedJobUpsertRow({ id: "job-77", status: "In Progress" }, "user-1", "editor");
  activeRow.updated_at = "2026-08-18T12:00:00.000Z";

  const split = splitSharedJobsByWorkflow([approvedRow, activeRow]);
  assert.equal(split.activeJobs.length, 1);
  assert.equal(split.activeJobs[0].status, "In Progress");
  assert.equal(split.approvedJobs.length, 0);
});

test("move action preserves the shared job identity and records an activity entry", () => {
  const moved = moveApprovedJobToActive(
    { id: "job-88", sourceRecordUid: "job:estimate-88", projectName: "Oak Street", activityLog: [] },
    { movedAt: "2026-08-24T22:00:00.000Z", movedBy: "Jorge", activityId: "activity-88" },
  );

  assert.equal(moved.id, "job-88");
  assert.equal(moved.sourceRecordUid, "job:estimate-88");
  assert.equal(moved.workflowStatus, "active");
  assert.equal(moved.status, "In Progress");
  assert.equal(moved.movedToActiveBy, "Jorge");
  assert.deepEqual(moved.activityLog[0], {
    id: "activity-88",
    summary: "Job moved from Approved Jobs to Active Jobs",
    changedBy: "Jorge",
    createdAt: "2026-08-24T22:00:00.000Z",
  });
});

test("mark complete moves an active job into durable completed history", () => {
  const completed = markActiveJobComplete(
    { id: "job-99", sourceRecordUid: "job:99", status: "In Progress", activityLog: [] },
    { completedAt: "2026-08-27T22:00:00.000Z", completedBy: "Jorge", activityId: "complete-99" },
  );
  const row = buildSharedJobUpsertRow(completed, "user-1", "Jorge");
  const split = splitSharedJobsByWorkflow([row]);

  assert.equal(completed.percentComplete, 100);
  assert.equal(completed.status, "Completed");
  assert.equal(completed.activityLog[0].summary, "Job marked complete");
  assert.equal(split.activeJobs.length, 0);
  assert.equal(split.completedJobs.length, 1);
  assert.equal(split.completedJobs[0].id, "job-99");
});

test("active job preview resolves address, homeowner, amount, and field lead", () => {
  assert.deepEqual(
    getActiveJobPreviewDetails({
      jobAddress: "123 Main Street, Irvine, CA",
      propertyOwner: "Natalia Rivera",
      finalBid: "$84,250.00",
      superintendent: "Chris",
    }),
    {
      address: "123 Main Street, Irvine, CA",
      homeowner: "Natalia Rivera",
      contractAmount: 84250,
      fieldLead: "Chris",
    },
  );
});

test("active job preview labels missing information clearly", () => {
  assert.deepEqual(getActiveJobPreviewDetails({}), {
    address: "Address not entered",
    homeowner: "Homeowner not entered",
    contractAmount: 0,
    fieldLead: "Not assigned",
  });
});

test("active job edit draft maps shared aliases into editable fields", () => {
  const draft = buildActiveJobEditDraft({
    projectName: "Oak Street Roof",
    jobAddress: "123 Oak Street",
    customerName: "Natalia Rivera",
    finalBid: "$95,000",
    fieldSupervisor: "Chris",
  });

  assert.equal(draft.address, "123 Oak Street");
  assert.equal(draft.customer, "Natalia Rivera");
  assert.equal(draft.contractAmount, 95000);
  assert.equal(draft.fieldSupervisor, "Chris");
});

test("saving active job details preserves identity, aliases, and activity history", () => {
  const saved = applyActiveJobEditDraft(
    { id: "job-90", sourceRecordUid: "job:90", activityLog: [{ id: "older" }] },
    {
      projectName: "Oak Street Roof",
      address: "123 Oak Street",
      customer: "Natalia Rivera",
      contractAmount: 95000,
      amountBilled: 25000,
      amountCollected: 20000,
      percentComplete: 35,
      status: "In Progress",
      fieldSupervisor: "Chris",
    },
    { updatedAt: "2026-08-24T23:00:00.000Z", updatedBy: "Jorge", activityId: "edit-90" },
  );

  assert.equal(saved.id, "job-90");
  assert.equal(saved.sourceRecordUid, "job:90");
  assert.equal(saved.projectAddress, "123 Oak Street");
  assert.equal(saved.jobAddress, "123 Oak Street");
  assert.equal(saved.customerName, "Natalia Rivera");
  assert.equal(saved.remainingContractValue, 70000);
  assert.equal(saved.workflowStatus, "active");
  assert.equal(saved.activityLog[0].summary, "Active job details updated");
  assert.equal(saved.activityLog[1].id, "older");
});
