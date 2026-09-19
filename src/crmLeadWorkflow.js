const CLOSED_LEAD_STATUSES = new Set(["Lost", "Not Qualified"]);

export function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

export function validateQuickLead(lead = {}) {
  const contact = String(lead.contactName || "").trim();
  const namedContact = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  const company = String(lead.companyName || "").trim();
  const phone = normalizePhone(lead.phone);
  const email = String(lead.email || "").trim();
  const address = String(lead.propertyAddress || "").trim();
  const errors = [];

  if (!contact && !namedContact && !company) errors.push("Enter a contact or company name.");
  if (!phone && !email && !address) errors.push("Enter a phone number, email, or property address.");

  return { valid: errors.length === 0, errors };
}

export function findPotentialDuplicateLead(leads = [], candidate = {}) {
  const candidatePhone = normalizePhone(candidate.phone);
  const candidateAddress = String(candidate.propertyAddress || "").trim().toLowerCase();
  if (!candidatePhone && !candidateAddress) return null;
  return leads.find((lead) => {
    if (String(lead.id || "") === String(candidate.id || "")) return false;
    const phoneMatch = candidatePhone && normalizePhone(lead.phone) === candidatePhone;
    const addressMatch = candidateAddress && String(lead.propertyAddress || "").trim().toLowerCase() === candidateAddress;
    return phoneMatch || addressMatch;
  }) || null;
}

export function findInspectionAssignee(profiles = []) {
  const normalized = profiles.map((profile) => ({
    ...profile,
    email: String(profile.email || "").trim().toLowerCase(),
    fullName: String(profile.full_name || profile.fullName || "").trim().toLowerCase(),
    role: String(profile.role || "").trim().toLowerCase(),
  }));

  return normalized.find((profile) => profile.email === "ivan@crtroofing.com")
    || normalized.find((profile) => profile.fullName === "ivan solano")
    || normalized.find((profile) => profile.fullName.startsWith("ivan ") && ["estimator", "salesperson", "admin"].includes(profile.role))
    || null;
}

export function buildInspectionTask(lead = {}) {
  const contactName = String(
    lead.contactName
      || [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim()
      || lead.companyName
      || "New caller",
  ).trim();
  const urgency = String(lead.urgency || "Normal").trim().toLowerCase();
  const detailLines = [
    "Please contact this customer to schedule a roof inspection.",
    `Contact: ${contactName}`,
    lead.companyName && lead.companyName !== contactName ? `Company: ${lead.companyName}` : "",
    lead.phone ? `Phone: ${lead.phone}` : "",
    lead.email ? `Email: ${lead.email}` : "",
    lead.propertyAddress ? `Property address: ${lead.propertyAddress}` : "",
    lead.roofingServiceNeeded ? `Requested service: ${lead.roofingServiceNeeded}` : "Requested service: Roof inspection",
    lead.bestTimeToCall ? `Best time to call: ${lead.bestTimeToCall}` : "",
    lead.description ? `Office notes: ${lead.description}` : "",
    lead.originatorName || lead.originatorEmail
      ? `Sent by: ${lead.originatorName || lead.originatorEmail}`
      : "",
  ].filter(Boolean);

  return {
    title: `Inspection Request: ${contactName}`,
    description: detailLines.join("\n"),
    priority: ["high", "rush", "urgent", "emergency"].includes(urgency) ? "high" : "normal",
  };
}

export function calculateLeadKpis(leads = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - ((day + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const originatorEmail = String(options.originatorEmail || "").trim().toLowerCase();
  const originatorId = String(options.originatorId || "").trim();
  const weeklyInspectionTarget = Math.max(0, Number(options.weeklyInspectionTarget) || 0);

  const attributed = leads.filter((lead) => {
    if (!originatorEmail && !originatorId) return true;
    const emailMatches = originatorEmail && String(lead.originatorEmail || "").trim().toLowerCase() === originatorEmail;
    const idMatches = originatorId && String(lead.originatorId || "") === originatorId;
    return emailMatches || idMatches;
  });
  const thisWeek = attributed.filter((lead) => new Date(lead.createdAt || 0) >= weekStart);
  const qualified = thisWeek.filter((lead) => lead.qualificationStatus === "qualified" || lead.qualifiedAt);
  const inspectionReady = thisWeek.filter((lead) => lead.acceptedForInspectionAt || lead.appointmentDate);
  const staleCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const stale = attributed.filter((lead) => {
    if (CLOSED_LEAD_STATUSES.has(String(lead.leadStatus || ""))) return false;
    return new Date(lead.lastActivityDate || lead.updatedAt || lead.createdAt || 0) < staleCutoff;
  });
  const processCompliant = attributed.filter((lead) => {
    const progressed = ["Proposal Sent", "Approved"].includes(String(lead.leadStatus || ""));
    return !progressed || Boolean(lead.qualifiedAt || lead.qualificationStatus === "qualified");
  }).length;

  return {
    total: attributed.length,
    capturedThisWeek: thisWeek.length,
    qualifiedThisWeek: qualified.length,
    inspectionReadyThisWeek: inspectionReady.length,
    qualificationRate: thisWeek.length ? qualified.length / thisWeek.length : 0,
    capacityCoverage: weeklyInspectionTarget ? inspectionReady.length / weeklyInspectionTarget : null,
    weeklyInspectionTarget,
    staleCount: stale.length,
    processComplianceRate: attributed.length ? processCompliant / attributed.length : 1,
  };
}

function startOfBusinessWeek(value) {
  const date = new Date(value);
  const day = date.getDay();
  date.setDate(date.getDate() - ((day + 6) % 7));
  date.setHours(0, 0, 0, 0);
  return date;
}

function historyTime(lead = {}, labels = [], after = null) {
  const wanted = labels.map((label) => String(label).trim().toLowerCase());
  const afterTime = after ? new Date(after).getTime() : 0;
  const matches = (Array.isArray(lead.history) ? lead.history : [])
    .filter((entry) => wanted.includes(String(entry.label || "").trim().toLowerCase()))
    .map((entry) => new Date(entry.createdAt || entry.created_at || 0))
    .filter((date) => Number.isFinite(date.getTime()) && date.getTime() >= afterTime)
    .sort((a, b) => a - b);
  return matches[0] || null;
}

export function businessMinutesBetween(startValue, endValue, workdayStart = 8, workdayEnd = 17) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return 0;

  let minutes = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);

  while (cursor <= lastDay) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const open = new Date(cursor);
      open.setHours(workdayStart, 0, 0, 0);
      const close = new Date(cursor);
      close.setHours(workdayEnd, 0, 0, 0);
      const rangeStart = new Date(Math.max(start.getTime(), open.getTime()));
      const rangeEnd = new Date(Math.min(end.getTime(), close.getTime()));
      if (rangeEnd > rangeStart) minutes += (rangeEnd - rangeStart) / 60_000;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return minutes;
}

export function calculateIvanKpis(leads = [], proposalRequests = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const weekStart = startOfBusinessWeek(now);
  const weeklyCapacity = Math.max(0, Number(options.weeklyInspectionTarget) || 0);
  const ivanUserId = String(options.ivanUserId || "").trim();
  const rows = Array.isArray(leads) ? leads : [];
  const requests = Array.isArray(proposalRequests) ? proposalRequests : [];
  const isThisWeek = (value) => {
    const date = new Date(value || 0);
    return Number.isFinite(date.getTime()) && date >= weekStart && date <= now;
  };
  const isIvanLead = (lead) => {
    const assignedIds = [lead.assignedStaffId, lead.assigned_staff_id, lead.acceptedForInspectionBy, lead.accepted_for_inspection_by]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    return (ivanUserId && assignedIds.includes(ivanUserId))
      || Boolean(historyTime(lead, ["Sent for inspection"]));
  };
  const ivanLeads = rows.filter(isIvanLead);
  const assignmentAt = (lead) => historyTime(lead, ["Sent for inspection"])
    || (lead.acceptedForInspectionAt || lead.accepted_for_inspection_at ? new Date(lead.acceptedForInspectionAt || lead.accepted_for_inspection_at) : null)
    || new Date(lead.createdAt || lead.created_at || 0);
  const contactAt = (lead, assignedAt) => historyTime(lead, ["Contacted", "Appointment Scheduled"], assignedAt)
    || (lead.inspectionScheduledAt || lead.inspection_scheduled_at ? new Date(lead.inspectionScheduledAt || lead.inspection_scheduled_at) : null);
  const completedAt = (lead) => historyTime(lead, ["Inspection Completed"])
    || (String(lead.leadStatus || lead.status || "") === "Inspection Completed" ? new Date(lead.updatedAt || lead.updated_at || 0) : null);

  const assignmentsThisWeek = ivanLeads
    .map((lead) => ({ lead, assignedAt: assignmentAt(lead) }))
    .filter((entry) => isThisWeek(entry.assignedAt));
  const completedThisWeek = ivanLeads
    .map((lead) => ({ lead, completedAt: completedAt(lead) }))
    .filter((entry) => entry.completedAt && isThisWeek(entry.completedAt));
  const executionDenominator = Math.min(assignmentsThisWeek.length, weeklyCapacity || assignmentsThisWeek.length);
  const executionRate = executionDenominator ? Math.min(1, completedThisWeek.length / executionDenominator) : null;
  const capacityCoverage = weeklyCapacity ? Math.min(1, assignmentsThisWeek.length / weeklyCapacity) : null;

  const contactEligible = assignmentsThisWeek.filter((entry) => {
    const contacted = contactAt(entry.lead, entry.assignedAt);
    return contacted || businessMinutesBetween(entry.assignedAt, now) >= 120;
  });
  const contactOnTime = contactEligible.filter((entry) => {
    const contacted = contactAt(entry.lead, entry.assignedAt);
    return contacted && businessMinutesBetween(entry.assignedAt, contacted) <= 120;
  });
  const contactSlaRate = contactEligible.length ? contactOnTime.length / contactEligible.length : null;

  const submittedRequests = requests.filter((request) => request.submitted_at);
  const requestForLead = (lead) => submittedRequests
    .filter((request) => String(request.source_lead_id || "") === String(lead.id || ""))
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))[0] || null;
  const handoffEligible = completedThisWeek.filter((entry) => {
    const request = requestForLead(entry.lead);
    return request || businessMinutesBetween(entry.completedAt, now) >= 9 * 60;
  });
  const handoffOnTime = handoffEligible.filter((entry) => {
    const request = requestForLead(entry.lead);
    return request && businessMinutesBetween(entry.completedAt, request.submitted_at) <= 9 * 60;
  });
  const handoffRate = handoffEligible.length ? handoffOnTime.length / handoffEligible.length : null;

  const ivanRequestsThisWeek = submittedRequests.filter((request) => {
    if (!isThisWeek(request.submitted_at)) return false;
    if (ivanUserId && String(request.salesperson_id || "") === ivanUserId) return true;
    return ivanLeads.some((lead) => String(lead.id || "") === String(request.source_lead_id || ""));
  });
  const reviewedRequestStatuses = new Set(["under_review", "missing_information", "drafting_proposal", "sales_review", "ready_to_send", "sent", "signed", "declined", "closed"]);
  const firstPassEligible = ivanRequestsThisWeek.filter((request) => reviewedRequestStatuses.has(String(request.status || "").toLowerCase()));
  const acceptedFirstPass = firstPassEligible.filter((request) => Number(request.missing_information_count || 0) === 0);
  const firstPassRate = firstPassEligible.length ? acceptedFirstPass.length / firstPassEligible.length : null;

  const activeInspectionStatuses = new Set(["Inspection Requested", "Contacted", "Appointment Scheduled", "Inspection Completed"]);
  const activeInspectionLeads = ivanLeads.filter((lead) => activeInspectionStatuses.has(String(lead.leadStatus || lead.status || "")));
  const staleLeads = activeInspectionLeads.filter((lead) => {
    const lastActivity = lead.lastActivityDate || lead.last_activity_date || lead.updatedAt || lead.updated_at || lead.createdAt || lead.created_at;
    return businessMinutesBetween(lastActivity, now) > 18 * 60;
  });
  const hygieneRate = activeInspectionLeads.length ? Math.max(0, 1 - staleLeads.length / activeInspectionLeads.length) : null;

  const scoreParts = [
    [executionRate, 35],
    [contactSlaRate, 15],
    [handoffRate, 25],
    [firstPassRate, 20],
    [hygieneRate, 5],
  ].filter(([rate]) => rate !== null);
  const activeWeight = scoreParts.reduce((sum, [, weight]) => sum + weight, 0);
  const overallScore = activeWeight
    ? Math.round(scoreParts.reduce((sum, [rate, weight]) => sum + rate * weight, 0) / activeWeight * 100)
    : null;

  return {
    weeklyCapacity,
    assignedThisWeek: assignmentsThisWeek.length,
    capacityCoverage,
    completedThisWeek: completedThisWeek.length,
    executionRate,
    contactEligible: contactEligible.length,
    contactOnTime: contactOnTime.length,
    contactSlaRate,
    handoffEligible: handoffEligible.length,
    handoffOnTime: handoffOnTime.length,
    handoffRate,
    proposalRequestsThisWeek: ivanRequestsThisWeek.length,
    firstPassEligible: firstPassEligible.length,
    acceptedFirstPass: acceptedFirstPass.length,
    firstPassRate,
    staleCount: staleLeads.length,
    staleLeadIds: staleLeads.map((lead) => lead.id),
    hygieneRate,
    overallScore,
  };
}

export function calculateDanielaKpis(proposalRequests = [], proposalVersions = [], auditEvents = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const periodDays = Math.max(1, Number(options.periodDays) || 30);
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const danielaUserId = String(options.danielaUserId || "").trim();
  const requests = (Array.isArray(proposalRequests) ? proposalRequests : []).filter((request) => {
    if (!danielaUserId) return true;
    return String(request.assigned_estimator_id || "") === danielaUserId;
  });
  const requestIds = new Set(requests.map((request) => String(request.id || "")));
  const versions = (Array.isArray(proposalVersions) ? proposalVersions : [])
    .filter((version) => requestIds.has(String(version.proposal_request_id || "")));
  const events = (Array.isArray(auditEvents) ? auditEvents : [])
    .filter((event) => requestIds.has(String(event.proposal_request_id || "")));
  const inPeriod = (value) => {
    const date = new Date(value || 0);
    return Number.isFinite(date.getTime()) && date >= periodStart && date <= now;
  };
  const periodRequests = requests.filter((request) => inPeriod(request.submitted_at));
  const eventFor = (requestId, actions) => events
    .filter((event) => String(event.proposal_request_id || "") === String(requestId || "") && actions.includes(String(event.action || "")))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0] || null;
  const finalizedVersionFor = (requestId) => versions
    .filter((version) => String(version.proposal_request_id || "") === String(requestId || "") && version.finalized_at)
    .sort((a, b) => new Date(a.finalized_at) - new Date(b.finalized_at))[0] || null;

  const intakeRows = periodRequests.map((request) => ({
    request,
    reviewEvent: eventFor(request.id, ["assigned", "information_requested"]),
  }));
  const intakeEligible = intakeRows.filter(({ request, reviewEvent }) => reviewEvent || businessMinutesBetween(request.submitted_at, now) >= 4 * 60);
  const intakeOnTime = intakeEligible.filter(({ request, reviewEvent }) => (
    reviewEvent && businessMinutesBetween(request.submitted_at, reviewEvent.created_at) <= 4 * 60
  ));
  const intakeResponseRate = intakeEligible.length ? intakeOnTime.length / intakeEligible.length : null;

  const turnaroundRows = periodRequests.map((request) => ({ request, version: finalizedVersionFor(request.id) }));
  const turnaroundEligible = turnaroundRows.filter(({ request, version }) => {
    if (!request.target_completion_at) return false;
    if (version) return true;
    if (String(request.status || "") === "missing_information" || request.sla_paused_at) return false;
    const effectiveTarget = new Date(request.target_completion_at).getTime() + Math.max(0, Number(request.sla_paused_seconds) || 0) * 1000;
    return Number.isFinite(effectiveTarget) && effectiveTarget <= now.getTime();
  });
  const turnaroundOnTime = turnaroundEligible.filter(({ request, version }) => {
    if (!version) return false;
    const effectiveTarget = new Date(request.target_completion_at).getTime() + Math.max(0, Number(request.sla_paused_seconds) || 0) * 1000;
    return new Date(version.finalized_at).getTime() <= effectiveTarget;
  });
  const turnaroundRate = turnaroundEligible.length ? turnaroundOnTime.length / turnaroundEligible.length : null;
  const completedTurnarounds = turnaroundRows.filter(({ version }) => version);
  const averageTurnaroundHours = completedTurnarounds.length
    ? completedTurnarounds.reduce((sum, { request, version }) => {
      const pausedMinutes = Math.max(0, Number(request.sla_paused_seconds) || 0) / 60;
      return sum + Math.max(0, businessMinutesBetween(request.submitted_at, version.finalized_at) - pausedMinutes);
    }, 0) / completedTurnarounds.length / 60
    : null;

  const finalizedThisPeriod = versions.filter((version) => version.finalized_at && inPeriod(version.finalized_at));
  const completeHandoffs = finalizedThisPeriod.filter((version) => (
    String(version.source_document_storage_path || "").trim()
    && String(version.final_pdf_storage_path || version.pdf_storage_path || "").trim()
  ));
  const documentCompletenessRate = finalizedThisPeriod.length ? completeHandoffs.length / finalizedThisPeriod.length : null;

  const completedStatuses = new Set(["sales_review", "ready_to_send", "sent", "signed", "declined", "closed"]);
  const activeQueue = requests.filter((request) => request.submitted_at
    && !completedStatuses.has(String(request.status || ""))
    && String(request.status || "") !== "missing_information");
  const overdueRequests = activeQueue.filter((request) => {
    if (!request.target_completion_at || request.sla_paused_at) return false;
    const effectiveTarget = new Date(request.target_completion_at).getTime() + Math.max(0, Number(request.sla_paused_seconds) || 0) * 1000;
    return Number.isFinite(effectiveTarget) && effectiveTarget < now.getTime();
  });
  const queueHygieneRate = activeQueue.length ? Math.max(0, 1 - overdueRequests.length / activeQueue.length) : null;

  const scoreParts = [
    [turnaroundRate, 45],
    [intakeResponseRate, 20],
    [documentCompletenessRate, 20],
    [queueHygieneRate, 15],
  ].filter(([rate]) => rate !== null);
  const activeWeight = scoreParts.reduce((sum, [, weight]) => sum + weight, 0);
  const overallScore = activeWeight
    ? Math.round(scoreParts.reduce((sum, [rate, weight]) => sum + rate * weight, 0) / activeWeight * 100)
    : null;

  return {
    periodDays,
    submittedCount: periodRequests.length,
    intakeEligible: intakeEligible.length,
    intakeOnTime: intakeOnTime.length,
    intakeResponseRate,
    turnaroundEligible: turnaroundEligible.length,
    turnaroundOnTime: turnaroundOnTime.length,
    turnaroundRate,
    averageTurnaroundHours,
    finalizedCount: finalizedThisPeriod.length,
    completeHandoffs: completeHandoffs.length,
    documentCompletenessRate,
    activeQueueCount: activeQueue.length,
    overdueCount: overdueRequests.length,
    overdueRequestIds: overdueRequests.map((request) => request.id),
    queueHygieneRate,
    missingInformationCount: periodRequests.filter((request) => Number(request.missing_information_count || 0) > 0).length,
    awaitingSalesReviewCount: requests.filter((request) => String(request.status || "") === "sales_review").length,
    sentCount: periodRequests.filter((request) => request.sent_at || ["sent", "signed", "closed"].includes(String(request.status || ""))).length,
    overallScore,
  };
}
