import { businessMinutesBetween } from "./crmLeadWorkflow.js";

const CLOSED_STATUSES = new Set(["completed", "closed"]);

function dateValue(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? new Date(value) : null;
  }
  const raw = String(value || "").trim();
  if (!raw) return null;
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateOnly(value) {
  const date = dateValue(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function businessDatesBetween(startValue, endValue) {
  const start = dateValue(startValue);
  const end = dateValue(endValue);
  if (!start || !end || end < start) return [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const final = new Date(end);
  final.setHours(0, 0, 0, 0);
  const dates = [];
  while (cursor <= final) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) dates.push(dateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function firstScheduledAt(job = {}) {
  const direct = dateValue(job.scheduledAt || job.scheduled_at);
  if (direct) return direct;
  const event = (Array.isArray(job.activityLog) ? job.activityLog : [])
    .filter((entry) => /schedule established|job scheduled|project scheduled/i.test(String(entry.summary || "")))
    .map((entry) => dateValue(entry.createdAt || entry.created_at))
    .filter(Boolean)
    .sort((a, b) => a - b)[0];
  if (event) return event;
  if (job.startDate || job.anticipatedStartDate) return dateValue(job.updatedAt || job.updated_at);
  return null;
}

function latestOperationalUpdate(job = {}) {
  const activityDates = (Array.isArray(job.activityLog) ? job.activityLog : [])
    .map((entry) => dateValue(entry.createdAt || entry.created_at))
    .filter(Boolean);
  const candidates = [dateValue(job.updatedAt || job.updated_at), ...activityDates].filter(Boolean);
  return candidates.sort((a, b) => b - a)[0] || null;
}

function isMiguelJob(job = {}, managerName = "Miguel Figueroa") {
  const assigned = String(job.projectManager || job.project_manager || "").trim().toLowerCase();
  if (!assigned) return true;
  const expected = String(managerName || "Miguel Figueroa").trim().toLowerCase();
  return assigned.includes("miguel") || assigned === expected;
}

export function calculateMiguelKpis(jobs = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const periodDays = Math.max(1, Number(options.periodDays) || 30);
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const managerName = String(options.managerName || "Miguel Figueroa");
  const rows = (Array.isArray(jobs) ? jobs : []).filter((job) => isMiguelJob(job, managerName));
  const statusOf = (job) => String(job.status || job.projectStatus || "").trim().toLowerCase();
  const workflowOf = (job) => String(job.workflowStatus || "").trim().toLowerCase();
  const active = rows.filter((job) => workflowOf(job) === "active" && !CLOSED_STATUSES.has(statusOf(job)));

  const releasedThisPeriod = rows.filter((job) => {
    const released = dateValue(job.productionAuthorizedAt || job.production_authorized_at || job.createdAt || job.created_at);
    return released && released >= periodStart && released <= now;
  });
  const schedulingRows = releasedThisPeriod.map((job) => ({
    job,
    releasedAt: dateValue(job.productionAuthorizedAt || job.production_authorized_at || job.createdAt || job.created_at),
    scheduledAt: firstScheduledAt(job),
  }));
  const schedulingEligible = schedulingRows.filter(({ releasedAt, scheduledAt }) => scheduledAt || businessMinutesBetween(releasedAt, now) >= 18 * 60);
  const scheduledOnTime = schedulingEligible.filter(({ releasedAt, scheduledAt }) => (
    scheduledAt && businessMinutesBetween(releasedAt, scheduledAt) <= 18 * 60
  ));
  const schedulingRate = schedulingEligible.length ? scheduledOnTime.length / schedulingEligible.length : null;

  let expectedLogDays = 0;
  let loggedDays = 0;
  rows.forEach((job) => {
    if (statusOf(job) === "on hold") return;
    const start = dateValue(job.startDate || job.anticipatedStartDate);
    if (!start || start > now) return;
    const completed = dateValue(job.completedAt || job.completed_at);
    const end = completed && completed < now ? completed : now;
    if (end < periodStart) return;
    const effectiveStart = start > periodStart ? start : periodStart;
    const expectedDates = businessDatesBetween(effectiveStart, end);
    const expectedSet = new Set(expectedDates);
    const recorded = new Set((Array.isArray(job.dailyProgressLog) ? job.dailyProgressLog : [])
      .map((day) => dateOnly(day.date || day.workDate || day.work_date))
      .filter((date) => expectedSet.has(date)));
    expectedLogDays += expectedDates.length;
    loggedDays += recorded.size;
  });
  const dailyLogRate = expectedLogDays ? Math.min(1, loggedDays / expectedLogDays) : null;

  const completionEligible = rows.filter((job) => {
    const expected = dateValue(job.expectedCompletionDate || job.expected_completion_date);
    if (!expected) return false;
    expected.setHours(23, 59, 59, 999);
    const completed = dateValue(job.completedAt || job.completed_at);
    return Boolean(completed && completed >= periodStart && completed <= now) || (!completed && expected < now && workflowOf(job) === "active");
  });
  const completedOnTime = completionEligible.filter((job) => {
    const completed = dateValue(job.completedAt || job.completed_at);
    const expected = dateValue(job.expectedCompletionDate || job.expected_completion_date);
    if (!completed || !expected) return false;
    expected.setHours(23, 59, 59, 999);
    return completed <= expected;
  });
  const completionRate = completionEligible.length ? completedOnTime.length / completionEligible.length : null;

  const hygieneEligible = active.filter((job) => latestOperationalUpdate(job) || dateValue(job.createdAt || job.created_at));
  const currentUpdates = hygieneEligible.filter((job) => {
    const lastUpdate = latestOperationalUpdate(job) || dateValue(job.createdAt || job.created_at);
    return businessMinutesBetween(lastUpdate, now) <= 18 * 60;
  });
  const updateHygieneRate = hygieneEligible.length ? currentUpdates.length / hygieneEligible.length : null;

  const upcoming = rows.filter((job) => {
    const start = dateValue(job.startDate || job.anticipatedStartDate);
    if (!start || CLOSED_STATUSES.has(statusOf(job))) return false;
    const daysAway = (start.getTime() - now.getTime()) / 86_400_000;
    return daysAway >= 0 && daysAway <= 7;
  });
  const blockedUpcoming = upcoming.filter((job) => (
    !String(job.startDate || job.anticipatedStartDate || "").trim()
    || !String(job.expectedCompletionDate || "").trim()
    || !String(job.fieldSupervisor || job.foreman || "").trim()
    || Boolean(job.documentsIncomplete || job.subcontractorIncomplete || job.materialOrderIncomplete || job.customerDocumentIncomplete)
  ));
  const attentionJobIds = [...new Set([
    ...active.filter((job) => !currentUpdates.includes(job)).map((job) => job.id),
    ...completionEligible.filter((job) => !completedOnTime.includes(job) && workflowOf(job) === "active").map((job) => job.id),
    ...blockedUpcoming.map((job) => job.id),
  ].filter(Boolean))];

  const scoreParts = [
    [completionRate, 35],
    [dailyLogRate, 25],
    [schedulingRate, 20],
    [updateHygieneRate, 20],
  ].filter(([rate]) => rate !== null);
  const activeWeight = scoreParts.reduce((sum, [, weight]) => sum + weight, 0);
  const overallScore = activeWeight
    ? Math.round(scoreParts.reduce((sum, [rate, weight]) => sum + rate * weight, 0) / activeWeight * 100)
    : null;

  return {
    periodDays,
    overallScore,
    activeJobs: active.length,
    releasedCount: releasedThisPeriod.length,
    schedulingEligible: schedulingEligible.length,
    scheduledOnTime: scheduledOnTime.length,
    schedulingRate,
    expectedLogDays,
    loggedDays,
    dailyLogRate,
    completionEligible: completionEligible.length,
    completedOnTime: completedOnTime.length,
    completionRate,
    hygieneEligible: hygieneEligible.length,
    currentUpdates: currentUpdates.length,
    updateHygieneRate,
    upcomingCount: upcoming.length,
    blockedUpcomingCount: blockedUpcoming.length,
    attentionJobIds,
  };
}
