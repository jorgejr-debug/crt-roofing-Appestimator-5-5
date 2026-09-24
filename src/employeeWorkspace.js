const normalize = (value) => String(value || "").trim().toLowerCase();

const WORKSPACES = {
  chris: {
    title: "Business Development",
    focus: "Capture qualified opportunities and keep Ivan's inspection pipeline full.",
    actions: ["collectLead", "sendInspection", "customers", "tasks"],
  },
  ivan: {
    title: "Estimator / Technician / Sales",
    focus: "Schedule inspections, capture roof findings, and hand complete scope to Daniela.",
    actions: ["inspections", "proposalRequests", "estimates", "customers", "tasks"],
  },
  daniela: {
    title: "Proposal Specialist / Estimating",
    focus: "Move complete proposal requests through review and customer delivery on time.",
    actions: ["proposalRequests", "tasks", "customers", "approvedJobs"],
  },
  miguel: {
    title: "Project Manager / Production",
    focus: "Schedule ready jobs, coordinate production, and keep active-job updates current.",
    actions: ["activeJobs", "fieldOperations", "tasks", "vendors"],
  },
  natalia: {
    title: "Office Manager / Administration",
    focus: "Keep invoicing, collections, vendor compliance, and office follow-up moving.",
    actions: ["invoices", "vendors", "tasks", "finance"],
  },
  management: {
    title: "Executive Management",
    focus: "Protect profitability, remove constraints, and hold the operating system accountable.",
    actions: ["finance", "tasks", "activeJobs", "approvedJobs", "invoices"],
  },
  default: {
    title: "Employee",
    focus: "Start the work assigned to you and keep the team updated.",
    actions: ["tasks", "customers", "proposalRequests", "activeJobs"],
  },
};

export function getEmployeeWorkspace({ email = "", role = "", capabilities = {} } = {}) {
  const normalizedEmail = normalize(email);
  const normalizedRole = normalize(role);
  let workspace = WORKSPACES.default;

  if (normalizedEmail === "chris@crtroofing.com") workspace = WORKSPACES.chris;
  else if (normalizedEmail === "ivan@crtroofing.com") workspace = WORKSPACES.ivan;
  else if (normalizedEmail === "daniela@crtroofing.com") workspace = WORKSPACES.daniela;
  else if (normalizedEmail === "miguel@crtroofing.com" || normalizedRole === "project_manager") workspace = WORKSPACES.miguel;
  else if (normalizedEmail === "natalia@crtroofing.com") workspace = WORKSPACES.natalia;
  else if (normalizedRole === "cfo" || normalizedRole === "admin") workspace = WORKSPACES.management;

  const allowed = workspace.actions.filter((action) => {
    if (action === "invoices") return Boolean(capabilities.canAccessInvoices);
    if (action === "finance") return Boolean(capabilities.canAccessFinance);
    if (action === "approvedJobs") return Boolean(capabilities.canViewApprovedJobs);
    return true;
  });

  return { ...workspace, actions: allowed };
}

export function getEmployeeNavigationKeys({ email = "", role = "", capabilities = {} } = {}) {
  const normalizedEmail = normalize(email);
  const normalizedRole = normalize(role);
  let keys = ["dashboard", "workHub", "crm", "fieldNotes", "proposalRequests", "activeJobs"];

  if (normalizedEmail === "chris@crtroofing.com") {
    keys = ["dashboard", "workHub", "crm", "proposalRequests"];
  } else if (normalizedEmail === "ivan@crtroofing.com") {
    keys = ["dashboard", "workHub", "crm", "fieldNotes", "estimateTemplates", "proposalRequests", "approvedJobs"];
  } else if (normalizedEmail === "daniela@crtroofing.com") {
    keys = ["dashboard", "workHub", "crm", "proposalRequests", "approvedJobs", "activeJobs"];
  } else if (normalizedEmail === "miguel@crtroofing.com" || normalizedRole === "project_manager") {
    keys = ["dashboard", "workHub", "kpis", "activeJobs", "subcontractors"];
  } else if (normalizedEmail === "natalia@crtroofing.com") {
    keys = ["dashboard", "workHub", "subcontractors", "approvedJobs", "activeJobs", "invoices", "cfoDashboard"];
  } else if (normalizedRole === "cfo" || normalizedRole === "admin") {
    keys = ["dashboard", "workHub", "crm", "fieldNotes", "estimateTemplates", "proposalRequests", "subcontractors", "approvedJobs", "activeJobs", "invoices", "archive", "cfoDashboard"];
  }

  return keys.filter((key) => {
    if (key === "invoices") return Boolean(capabilities.canAccessInvoices);
    if (key === "cfoDashboard") return Boolean(capabilities.canAccessFinance);
    return true;
  });
}
