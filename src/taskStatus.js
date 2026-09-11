export const CLOSED_TASK_STATUSES = new Set(["completed", "voided"]);

const STATUS_LABELS = {
  open: "Open",
  in_progress: "Working on It",
  blocked: "Blocked",
  completed: "Completed",
  voided: "Voided",
};

const TASK_TYPE_LABELS = {
  general: "General Task",
  proposal_request: "Proposal Request",
  payment_follow_up: "Payment Follow-up",
};

function localDateKey(value = new Date()) {
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isTaskClosed(task = {}) {
  return CLOSED_TASK_STATUSES.has(String(task.status || "open").toLowerCase());
}

export function isTaskPastDue(task = {}, today = new Date()) {
  const dueDate = String(task.due_date || "").slice(0, 10);
  return Boolean(dueDate) && !isTaskClosed(task) && dueDate < localDateKey(today);
}

export function taskStatusLabel(task = {}, today = new Date()) {
  if (isTaskPastDue(task, today)) return "Past Due";
  const status = String(task.status || "open").toLowerCase();
  return STATUS_LABELS[status] || status.replaceAll("_", " ");
}

export function taskType(task = {}) {
  if (String(task.related_type || "").toLowerCase() === "receivable_payment_follow_up") return "payment_follow_up";
  if (String(task.task_type || "").toLowerCase() === "proposal_request") return "proposal_request";
  return "general";
}

export function taskTypeLabel(task = {}) {
  return TASK_TYPE_LABELS[taskType(task)] || TASK_TYPE_LABELS.general;
}

export function taskMatchesView(task = {}, view = "active", today = new Date()) {
  if (view === "all") return true;
  if (view === "past_due") return isTaskPastDue(task, today);
  if (view === "completed" || view === "voided") return String(task.status || "open").toLowerCase() === view;
  return !isTaskClosed(task);
}
