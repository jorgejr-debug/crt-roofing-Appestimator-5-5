export const PROPOSAL_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "missing_information",
  "drafting_proposal",
  "sales_review",
  "ready_to_send",
  "sent",
  "signed",
  "declined",
  "closed",
];

export const PROPOSAL_REQUEST_PRIORITIES = ["normal", "high", "rush"];

export const PROPOSAL_JOB_TYPES = [
  { value: "minor_repair", label: "Minor repair / maintenance", businessDays: 1 },
  { value: "standard_roof", label: "Standard reroof / SPF / TPO", businessDays: 1 },
  { value: "complex_commercial", label: "Complex commercial / HOA", businessDays: 2 },
  { value: "large_rfp", label: "Large RFP / multi-building", businessDays: null },
];

export const SALES_APPROVAL_ACKNOWLEDGEMENT =
  "I confirm that the scope, measurements, production assumptions, exclusions, and pricing information accurately represent what I intend to propose to this customer.";

export const REQUIRED_PROPOSAL_REQUEST_FIELDS = [
  ["customer_name", "Customer name"],
  ["property_name", "Property / job name"],
  ["service_address", "Property service address"],
  ["billing_information", "Billing information"],
  ["project_contact_first_name", "Project contact first name"],
  ["project_contact_last_name", "Project contact last name"],
  ["project_contact_phone", "Project contact phone number"],
  ["project_contact_email", "Project contact email"],
  ["salesperson_id", "Assigned salesperson"],
  ["scope_of_work", "Detailed scope of work"],
  ["roof_areas", "Roof areas / sections"],
  ["roofing_system", "Roofing system"],
  ["work_type", "Work type"],
  ["measurements", "Measurements / square footage / squares"],
  ["roof_measurement_notes", "Roof measurement notes"],
  ["property_type", "Property type"],
  ["story_count", "Building story count"],
  ["construction_type", "Existing roof or new construction"],
  ["material_specifications", "Material / system specifications"],
  ["estimated_crew_size", "Estimated crew size"],
  ["estimated_working_days", "Estimated working days"],
  ["estimated_material_quantities", "Estimated material quantities"],
  ["estimated_labor_assumptions", "Estimated labor assumptions"],
  ["customer_deadline", "Customer deadline"],
];

function present(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return String(value ?? "").trim().length > 0;
}

export function validateProposalRequest(request = {}) {
  const missing = REQUIRED_PROPOSAL_REQUEST_FIELDS.filter(([key]) => !present(request[key])).map(([, label]) => label);
  if (request.job_type === "large_rfp" && !present(request.manual_target_at)) {
    missing.push("Manual ETA for a large RFP / multi-building project");
  }
  return { valid: missing.length === 0, missing };
}

export function addBusinessDays(start, businessDays) {
  const date = new Date(start);
  if (Number.isNaN(date.getTime()) || businessDays == null) return null;
  let remaining = Math.max(0, Number(businessDays) || 0);
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}

export function calculateDefaultTargetAt(submittedAt, jobType) {
  const type = PROPOSAL_JOB_TYPES.find((item) => item.value === jobType);
  return type?.businessDays == null ? null : addBusinessDays(submittedAt, type.businessDays)?.toISOString() || null;
}

export function getSlaDisplay(request = {}, now = new Date()) {
  if (request.sla_paused_at) return { tone: "missing", label: "SLA paused — missing information" };
  const target = new Date(request.target_completion_at || request.manual_target_at || "");
  if (Number.isNaN(target.getTime())) return { tone: "neutral", label: "Manual ETA required" };
  const delta = target.getTime() - new Date(now).getTime();
  if (delta < 0) return { tone: "overdue", label: `Overdue by ${formatDuration(Math.abs(delta))}` };
  if (delta <= 4 * 60 * 60 * 1000) return { tone: "due", label: `${formatDuration(delta)} remaining` };
  if (target.toDateString() === new Date(now).toDateString()) return { tone: "due", label: "Due today" };
  return { tone: "normal", label: `${formatDuration(delta)} remaining` };
}

function formatDuration(milliseconds) {
  const hours = Math.max(0, Math.ceil(milliseconds / 3_600_000));
  if (hours < 24) return `${hours}h`;
  return `${Math.ceil(hours / 24)}d`;
}

export function buildProductionGateReasons(request = {}, versions = [], changeOrders = []) {
  const latestVersion = [...versions].sort((a, b) => Number(b.version_number || 0) - Number(a.version_number || 0))[0];
  const reasons = [];
  if (!latestVersion?.finalized_at) reasons.push("Proposal not finalized");
  if (!latestVersion?.sales_approved_at || !latestVersion?.sales_approved_by) reasons.push("Salesperson scope approval missing");
  if (latestVersion?.customer_decision !== "signed" || !latestVersion?.customer_signed_at) reasons.push("Customer signature missing");
  if (!String(latestVersion?.signed_pdf_storage_path || "").trim()) reasons.push("Signed proposal document missing");
  const sections = Array.isArray(latestVersion?.sections) ? latestVersion.sections : [];
  if (!sections.some((section) => section.customer_approved === true)) reasons.push("No proposal sections are approved");
  if (request.deposit_required && !request.deposit_satisfied_at) reasons.push("Required deposit not received");
  if (changeOrders.some((order) => order.required_for_release && order.status !== "signed")) reasons.push("Required change order not signed");
  if (!request.production_scope_generated_at) reasons.push("Production scope has not been generated");
  return reasons;
}

export function calculateProposalMetrics(requests = []) {
  const rows = Array.isArray(requests) ? requests : [];
  const completed = rows.filter((row) => row.submitted_at && (row.sent_at || row.signed_at || row.declined_at || row.closed_at));
  const turnaroundHours = completed.map((row) => {
    const start = new Date(row.submitted_at).getTime();
    const end = new Date(row.sent_at || row.signed_at || row.declined_at || row.closed_at).getTime();
    return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, (end - start - Number(row.sla_paused_seconds || 0) * 1000) / 3_600_000) : 0;
  });
  const submitted = rows.filter((row) => row.submitted_at).length;
  const signed = rows.filter((row) => row.status === "signed" || row.signed_at).length;
  return {
    submitted,
    sent: rows.filter((row) => ["sent", "signed"].includes(row.status) || row.sent_at).length,
    signed,
    overdue: rows.filter((row) => row.target_completion_at && new Date(row.target_completion_at) < new Date() && !["sent", "signed", "declined", "closed"].includes(row.status)).length,
    missingInformation: rows.filter((row) => Number(row.missing_information_count || 0) > 0).length,
    averageTurnaroundHours: turnaroundHours.length ? turnaroundHours.reduce((sum, value) => sum + value, 0) / turnaroundHours.length : 0,
    conversionRate: submitted ? (signed / submitted) * 100 : 0,
    unauthorizedStarts: rows.filter((row) => row.production_started_without_authorization).length,
  };
}
