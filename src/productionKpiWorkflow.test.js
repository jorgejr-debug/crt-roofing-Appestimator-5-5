import assert from "node:assert/strict";
import test from "node:test";
import { calculateMiguelKpis } from "./productionKpiWorkflow.js";

test("Miguel KPI scores production scheduling, daily logs, completion, and update hygiene", () => {
  const jobs = [
    {
      id: "job-1",
      workflowStatus: "completed",
      projectManager: "Miguel Figueroa",
      productionAuthorizedAt: "2026-09-01T08:00:00-07:00",
      scheduledAt: "2026-09-01T14:00:00-07:00",
      startDate: "2026-09-02",
      expectedCompletionDate: "2026-09-03",
      completedAt: "2026-09-03T16:00:00-07:00",
      dailyProgressLog: [{ date: "2026-09-02" }, { date: "2026-09-03" }],
      updatedAt: "2026-09-03T16:00:00-07:00",
    },
    {
      id: "job-2",
      workflowStatus: "active",
      status: "In Progress",
      projectManager: "",
      productionAuthorizedAt: "2026-09-08T08:00:00-07:00",
      startDate: "2026-09-09",
      expectedCompletionDate: "2026-09-10",
      fieldSupervisor: "Carlos",
      dailyProgressLog: [{ date: "2026-09-09" }],
      updatedAt: "2026-09-09T16:00:00-07:00",
    },
    {
      id: "other-manager",
      workflowStatus: "active",
      projectManager: "Someone Else",
      productionAuthorizedAt: "2026-09-01T08:00:00-07:00",
    },
  ];
  const kpis = calculateMiguelKpis(jobs, {
    now: new Date("2026-09-10T12:00:00-07:00"),
    periodDays: 30,
  });

  assert.equal(kpis.activeJobs, 1);
  assert.equal(kpis.releasedCount, 2);
  assert.equal(kpis.scheduledOnTime, 2);
  assert.equal(kpis.schedulingEligible, 2);
  assert.equal(kpis.completedOnTime, 1);
  assert.equal(kpis.completionEligible, 1);
  assert.equal(kpis.loggedDays, 3);
  assert.equal(kpis.expectedLogDays, 4);
  assert.equal(kpis.currentUpdates, 1);
  assert.equal(Number.isFinite(kpis.overallScore), true);
});
