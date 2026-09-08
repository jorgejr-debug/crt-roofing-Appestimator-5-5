const ACTIVE_JOB_ACTIVE_STATUSES = new Set(["scheduled", "pre-construction", "active", "punch list", "on hold", "warranty", "in progress"]);

function safeString(value) {
  return String(value || "").trim();
}

function safeAmount(value) {
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isActiveJobStatus(status) {
  return ACTIVE_JOB_ACTIVE_STATUSES.has(safeString(status).toLowerCase());
}

export function canManageSharedJobs(role) {
  const normalized = safeString(role).toLowerCase();
  return normalized === "admin" || normalized === "cfo";
}

export function canUpdateDailyJobCosts(role, email = "") {
  const normalizedEmail = safeString(email).toLowerCase();
  return canManageSharedJobs(role) || normalizedEmail === "daniela@crtroofing.com";
}

export function canCreateApprovedJobs(role, email = "") {
  const normalized = safeString(role).toLowerCase();
  const normalizedEmail = safeString(email).toLowerCase();
  return normalized === "admin" || normalized === "cfo" || normalizedEmail === "ivan@crtroofing.com";
}

export function inferWorkflowStatus(job = {}) {
  const explicit = safeString(job.workflowStatus).toLowerCase();
  if (explicit) return explicit;

  const status = safeString(job.projectStatus || job.status).toLowerCase();
  if (!status) return "approved";
  if (["archived", "deleted"].includes(status)) return "archived";
  if (["completed", "closed"].includes(status)) return "completed";
  if (isActiveJobStatus(status)) return "active";
  return "approved";
}

export function buildSharedJobSourceId(job = {}) {
  const direct = safeString(job.sourceRecordUid || job.source_record_uid || job.id || job.estimateId || job.localEstimateId || job.jobNumber);
  if (direct) return direct.startsWith("job:") ? direct : `job:${direct}`;
  return `job:auto:${Date.now()}`;
}

export function buildCfoApprovedJobSharedJob(entry = {}) {
  const entryId = safeString(entry.id);
  const projectName = safeString(entry.recordName || entry.record_name) || "Untitled approved job";
  const status = safeString(entry.status) || "Approved";
  const sourceRecordUid = `job:cfo-approved:${entryId}`;

  return {
    id: `cfo-approved:${entryId}`,
    sourceRecordUid,
    cfoApprovedJobEntryId: entryId,
    projectName,
    jobName: projectName,
    contractAmount: safeAmount(entry.amount),
    finalBid: safeAmount(entry.amount),
    approvalDate: safeString(entry.recordDate || entry.record_date),
    projectStatus: status,
    status,
    note: safeString(entry.note),
    workflowStatus: "approved",
  };
}

export function mapSharedJobRowToJob(row = {}) {
  const payload = row.job_payload && typeof row.job_payload === "object" ? row.job_payload : {};
  const workflowStatus = safeString(row.workflow_status || payload.workflowStatus || "approved").toLowerCase();
  const normalizedId = safeString(payload.id || row.source_record_uid || row.id);

  const merged = {
    ...payload,
    id: normalizedId,
    estimateId: safeString(payload.estimateId || row.estimate_id || row.local_estimate_id || normalizedId),
    localEstimateId: safeString(payload.localEstimateId || row.local_estimate_id || row.estimate_id || normalizedId),
    estimateCode: safeString(payload.estimateCode || row.estimate_code),
    jobNumber: safeString(payload.jobNumber || row.job_number),
    customerName: safeString(payload.customerName || row.customer_name),
    customer: safeString(payload.customer || row.customer_name),
    projectName: safeString(payload.projectName || row.project_name || row.job_name),
    jobName: safeString(payload.jobName || row.job_name || row.project_name),
    projectAddress: safeString(payload.projectAddress || row.address || row.job_address),
    jobAddress: safeString(payload.jobAddress || row.job_address || row.address),
    projectStatus: safeString(payload.projectStatus || row.status),
    status: safeString(payload.status || row.status),
    anticipatedStartDate: safeString(payload.anticipatedStartDate || row.start_date),
    projectContact: safeString(payload.projectContact || row.project_contact),
    fieldSupervisor: safeString(payload.fieldSupervisor || row.field_supervisor),
    permitStatus: safeString(payload.permitStatus || ""),
    riskLevel: safeString(payload.riskLevel || row.risk_level || "Normal"),
    finalBid: Number(payload.finalBid ?? row.final_bid ?? 0) || 0,
    contractAmount: Number(payload.contractAmount ?? row.contract_amount ?? row.final_bid ?? 0) || 0,
    dailyProgressLog: Array.isArray(payload.dailyProgressLog) ? payload.dailyProgressLog : Array.isArray(row.daily_progress_log) ? row.daily_progress_log : [],
    issues: Array.isArray(payload.issues) ? payload.issues : [],
    activityLog: Array.isArray(payload.activityLog) ? payload.activityLog : [],
    workflowStatus,
    sourceRecordUid: safeString(row.source_record_uid || payload.sourceRecordUid || normalizedId),
    updatedAt: safeString(row.updated_at || payload.updatedAt || ""),
  };

  return merged;
}

export function buildSharedJobUpsertRow(job = {}, userKey = "", updatedBy = "") {
  const workflowStatus = inferWorkflowStatus(job);
  const sourceRecordUid = buildSharedJobSourceId(job);
  const projectStatus = safeString(job.projectStatus || job.status || "Approved");
  const payload = {
    ...job,
    sourceRecordUid,
    workflowStatus,
    updatedAt: new Date().toISOString(),
  };

  return {
    source_record_uid: sourceRecordUid,
    user_key: safeString(userKey || "shared"),
    local_estimate_id: safeString(job.localEstimateId || job.estimateId || job.id || ""),
    estimate_id: safeString(job.estimateId || job.localEstimateId || job.id || ""),
    estimate_code: safeString(job.estimateCode || ""),
    job_number: safeString(job.jobNumber || ""),
    job_name: safeString(job.jobName || job.projectName || ""),
    project_name: safeString(job.projectName || job.jobName || ""),
    customer_name: safeString(job.customerName || job.customer || ""),
    address: safeString(job.projectAddress || job.jobAddress || ""),
    job_address: safeString(job.jobAddress || job.projectAddress || ""),
    status: projectStatus,
    workflow_status: workflowStatus,
    contract_amount: Number(job.contractAmount ?? job.finalBid ?? job.approvedBidAmount ?? 0) || 0,
    final_bid: Number(job.finalBid ?? job.contractAmount ?? job.approvedBidAmount ?? 0) || 0,
    start_date: safeString(job.anticipatedStartDate || job.startDate || "") || null,
    project_contact: safeString(job.projectContact || ""),
    field_supervisor: safeString(job.fieldSupervisor || ""),
    risk_level: safeString(job.riskLevel || "Normal"),
    daily_progress_log: Array.isArray(job.dailyProgressLog) ? job.dailyProgressLog : [],
    actual_labor_hours: Number(job.actualLaborHours ?? 0) || 0,
    actual_labor_cost: Number(job.actualLaborCost ?? 0) || 0,
    actual_cost: Number(job.actualCost ?? 0) || 0,
    is_active: workflowStatus !== "archived",
    updated_by: safeString(updatedBy) || null,
    updated_at: new Date().toISOString(),
    saved_at: new Date().toISOString(),
    job_payload: payload,
  };
}

export function splitSharedJobsByWorkflow(rows = []) {
  const newestBySource = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const sourceId = safeString(row.source_record_uid || row.sourceRecordUid || row.id);
    if (!sourceId) return;
    const current = newestBySource.get(sourceId);
    const incomingTime = Date.parse(row.updated_at || row.saved_at || "") || 0;
    const currentTime = current ? Date.parse(current.updated_at || current.saved_at || "") || 0 : -1;
    if (!current || incomingTime >= currentTime) {
      newestBySource.set(sourceId, row);
    }
  });

  const normalizedJobs = [...newestBySource.values()].map(mapSharedJobRowToJob);
  const archivedJobs = normalizedJobs.filter((job) => job.workflowStatus === "archived");
  const allJobs = normalizedJobs.filter((job) => job.workflowStatus !== "archived");

  const activeJobs = allJobs.filter((job) => job.workflowStatus === "active");
  const approvedJobs = allJobs.filter((job) => ["approved", "upcoming"].includes(job.workflowStatus));
  const completedJobs = allJobs.filter((job) => job.workflowStatus === "completed");

  return { allJobs, activeJobs, approvedJobs, completedJobs, archivedJobs };
}

export function buildCfoApprovedJobsLedger(jobs = []) {
  const uniqueJobs = new Map();
  (Array.isArray(jobs) ? jobs : []).forEach((job) => {
    const sourceKey = safeString(job.sourceRecordUid || job.source_record_uid || job.id);
    if (!sourceKey) return;
    const workflowStatus = inferWorkflowStatus(job);
    const projectStatus = safeString(job.projectStatus || job.status).toLowerCase();
    if (!["approved", "upcoming", "active"].includes(workflowStatus)) return;
    if (["completed", "closed", "archived", "deleted"].includes(projectStatus)) return;
    uniqueJobs.set(sourceKey, job);
  });

  const entries = [...uniqueJobs.values()].map((job) => ({
    id: safeString(job.id || job.sourceRecordUid),
    recordName: safeString(job.projectName || job.jobName || job.jobNumber) || "Untitled approved job",
    amount: safeAmount(job.contractAmount ?? job.finalBid ?? job.approvedBidAmount),
    recordDate: safeString(job.approvalDate || job.anticipatedStartDate || job.startDate || job.updatedAt).slice(0, 10),
    status: safeString(job.projectStatus || job.status) || "Approved",
    note: safeString(job.note),
    sharedJob: job,
  }));

  return {
    entries,
    count: entries.length,
    total: entries.reduce((sum, entry) => sum + entry.amount, 0),
  };
}

export function moveApprovedJobToActive(job = {}, options = {}) {
  const movedAt = safeString(options.movedAt) || new Date().toISOString();
  const movedBy = safeString(options.movedBy) || "Unknown";
  return {
    ...job,
    workflowStatus: "active",
    status: "In Progress",
    projectStatus: "In Progress",
    isActive: true,
    movedToActiveAt: movedAt,
    movedToActiveBy: movedBy,
    activityLog: [
      {
        id: safeString(options.activityId) || `activity-move-active-${movedAt}`,
        summary: "Job moved from Approved Jobs to Active Jobs",
        changedBy: movedBy,
        createdAt: movedAt,
      },
      ...(Array.isArray(job.activityLog) ? job.activityLog : []),
    ],
  };
}

export function markActiveJobComplete(job = {}, options = {}) {
  const completedAt = safeString(options.completedAt) || new Date().toISOString();
  const completedBy = safeString(options.completedBy) || "Unknown";
  return {
    ...job,
    workflowStatus: "completed",
    status: "Completed",
    projectStatus: "Completed",
    isActive: false,
    percentComplete: 100,
    completedAt,
    completedBy,
    activityLog: [
      {
        id: safeString(options.activityId) || `activity-complete-${completedAt}`,
        summary: "Job marked complete",
        changedBy: completedBy,
        createdAt: completedAt,
      },
      ...(Array.isArray(job.activityLog) ? job.activityLog : []),
    ],
  };
}

export function getActiveJobPreviewDetails(job = {}) {
  return {
    address: safeString(job.projectAddress || job.jobAddress || job.address) || "Address not entered",
    homeowner: safeString(job.customerName || job.customer || job.propertyOwner) || "Homeowner not entered",
    contractAmount: safeAmount(job.contractAmount ?? job.finalBid ?? job.approvedBidAmount),
    fieldLead: safeString(job.fieldSupervisor || job.superintendent || job.foreman) || "Not assigned",
  };
}

export function buildActiveJobEditDraft(job = {}) {
  return {
    projectName: safeString(job.projectName || job.jobName),
    jobNumber: safeString(job.jobNumber),
    address: safeString(job.projectAddress || job.jobAddress || job.address),
    customer: safeString(job.customerName || job.customer),
    propertyOwner: safeString(job.propertyOwner),
    propertyManager: safeString(job.propertyManager),
    projectContact: safeString(job.projectContact),
    projectManager: safeString(job.projectManager),
    fieldSupervisor: safeString(job.fieldSupervisor),
    foreman: safeString(job.foreman),
    salesperson: safeString(job.salesperson),
    officeCoordinator: safeString(job.officeCoordinator),
    contractAmount: safeAmount(job.contractAmount ?? job.finalBid),
    amountBilled: safeAmount(job.amountBilled),
    amountCollected: safeAmount(job.amountCollected),
    percentComplete: Math.min(100, Math.max(0, safeAmount(job.percentComplete))),
    status: safeString(job.status || job.projectStatus) || "In Progress",
    currentPhase: safeString(job.currentPhase),
    riskLevel: safeString(job.riskLevel) || "Normal",
    riskReason: safeString(job.riskReason),
    startDate: safeString(job.startDate || job.anticipatedStartDate),
    expectedCompletionDate: safeString(job.expectedCompletionDate),
  };
}

export function applyActiveJobEditDraft(job = {}, draft = {}, options = {}) {
  const normalized = buildActiveJobEditDraft(draft);
  const updatedAt = safeString(options.updatedAt) || new Date().toISOString();
  const updatedBy = safeString(options.updatedBy) || "Unknown";
  const remainingContractValue = Math.max(0, normalized.contractAmount - normalized.amountBilled);
  return {
    ...job,
    ...normalized,
    jobName: normalized.projectName,
    projectAddress: normalized.address,
    jobAddress: normalized.address,
    customerName: normalized.customer,
    projectStatus: normalized.status,
    finalBid: normalized.contractAmount,
    anticipatedStartDate: normalized.startDate,
    remainingContractValue,
    workflowStatus: "active",
    isActive: true,
    updatedAt,
    activityLog: [
      {
        id: safeString(options.activityId) || `activity-edit-active-${updatedAt}`,
        summary: "Active job details updated",
        changedBy: updatedBy,
        createdAt: updatedAt,
      },
      ...(Array.isArray(job.activityLog) ? job.activityLog : []),
    ],
  };
}
