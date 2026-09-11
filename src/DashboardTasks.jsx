import { useCallback, useEffect, useMemo, useState } from "react";
import "./DashboardTasks.css";
import { taskStatusLabel } from "./taskStatus.js";

function formatDueDate(value) {
  if (!value) return "No due date";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DashboardTasks({
  supabase,
  authUser,
  role = "salesperson",
  activeJobs = [],
  canAccessInvoices = false,
  canManageCompliance = false,
  onOpenTasks,
  onOpenProposals,
  onOpenActiveJobs,
  onOpenInvoices,
  onOpenVendors,
}) {
  const authUserKey = authUser?.key;
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [proposalRequests, setProposalRequests] = useState([]);
  const [invoiceRequests, setInvoiceRequests] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardTasks = useCallback(async ({ quiet = false } = {}) => {
    if (!authUserKey) return;
    if (!quiet) setLoading(true);
    const [taskResult, notificationResult, proposalResult, invoiceResult, subcontractorResult] = await Promise.all([
      supabase.from("company_tasks").select("id, title, description, status, priority, due_date, created_by, created_at, updated_at").not("status", "in", '("completed","voided")').order("due_date", { ascending: true, nullsFirst: false }).limit(8),
      supabase.from("company_task_notifications").select("id, task_id, created_at, read_at").eq("user_id", authUserKey).order("created_at", { ascending: false }).limit(50),
      supabase.from("proposal_requests").select("id, status, target_completion_at, salesperson_id, assigned_estimator_id").order("target_completion_at", { ascending: true, nullsFirst: false }).limit(100),
      canAccessInvoices
        ? supabase.from("invoice_requests").select("id, status").order("submitted_at", { ascending: false }).limit(100)
        : Promise.resolve({ data: [], error: null }),
      canManageCompliance
        ? supabase.from("subcontractors").select("id, workers_comp_active, workers_comp_expiration_date, is_active").eq("is_active", true).limit(250)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (!taskResult.error) setTasks(taskResult.data || []);
    if (!notificationResult.error) setNotifications(notificationResult.data || []);
    if (!proposalResult.error) setProposalRequests(proposalResult.data || []);
    if (!invoiceResult.error) setInvoiceRequests(invoiceResult.data || []);
    if (!subcontractorResult.error) setSubcontractors(subcontractorResult.data || []);
    setLoading(false);
  }, [authUserKey, canAccessInvoices, canManageCompliance, supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadDashboardTasks(); }, 0);
    if (!authUserKey) return () => window.clearTimeout(initialLoad);
    const channel = supabase
      .channel(`dashboard-tasks-${authUserKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "company_tasks" }, () => loadDashboardTasks({ quiet: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "company_task_assignees" }, () => loadDashboardTasks({ quiet: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "company_task_notifications", filter: `user_id=eq.${authUserKey}` }, () => loadDashboardTasks({ quiet: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "proposal_requests" }, () => loadDashboardTasks({ quiet: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "invoice_requests" }, () => loadDashboardTasks({ quiet: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "subcontractors" }, () => loadDashboardTasks({ quiet: true }))
      .subscribe();
    return () => {
      window.clearTimeout(initialLoad);
      supabase.removeChannel(channel);
    };
  }, [authUserKey, loadDashboardTasks, supabase]);

  const unreadTaskIds = useMemo(() => new Set(notifications.filter((item) => !item.read_at).map((item) => item.task_id)), [notifications]);
  const unreadCount = unreadTaskIds.size;

  const openTaskWorkspace = async (taskId = "") => {
    if (taskId && unreadTaskIds.has(taskId)) {
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => item.task_id === taskId && !item.read_at ? { ...item, read_at: readAt } : item));
      await supabase.from("company_task_notifications").update({ read_at: readAt }).eq("user_id", authUserKey).eq("task_id", taskId).is("read_at", null);
    }
    onOpenTasks(taskId);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysFromToday = new Date(today);
  thirtyDaysFromToday.setDate(thirtyDaysFromToday.getDate() + 30);
  const overdueTaskCount = tasks.filter((task) => task.due_date && new Date(`${task.due_date}T23:59:59`) < today).length;
  const normalizedRole = String(role || "salesperson").toLowerCase();
  const managesProposalQueue = ["admin", "cfo", "estimator"].includes(normalizedRole) || String(authUser?.email || "").toLowerCase() === "daniela@crtroofing.com";
  const proposalAttentionCount = proposalRequests.filter((request) => {
    const status = String(request.status || "").toLowerCase();
    if (["missing_information", "sales_review"].includes(status)) return true;
    if (status === "submitted") return managesProposalQueue;
    if (["sent", "signed", "declined", "closed", "draft"].includes(status)) return false;
    const target = request.target_completion_at ? new Date(request.target_completion_at) : null;
    return target && !Number.isNaN(target.getTime()) && target < new Date();
  }).length;
  const invoiceAttentionCount = invoiceRequests.filter((request) => ["Ready for Invoice", "Ready to Send", "Send Failed", "Missing Information"].includes(String(request.status || ""))).length;
  const expiringComplianceCount = subcontractors.filter((record) => {
    if (!record.workers_comp_active || !record.workers_comp_expiration_date) return false;
    const expiration = new Date(`${record.workers_comp_expiration_date}T12:00:00`);
    return !Number.isNaN(expiration.getTime()) && expiration <= thirtyDaysFromToday;
  }).length;
  const activeIssueCount = activeJobs.reduce((total, job) => total + (job.issues || []).filter((issue) => !["resolved", "closed"].includes(String(issue.status || "").toLowerCase())).length, 0);
  const attentionItems = [
    { key: "tasks", label: "Past-due tasks", count: overdueTaskCount, hint: unreadCount ? `${unreadCount} new update${unreadCount === 1 ? "" : "s"}` : "Assigned work", action: () => openTaskWorkspace("") },
    { key: "proposals", label: "Proposal actions", count: proposalAttentionCount, hint: "Review, missing info, or overdue", action: onOpenProposals },
    { key: "jobs", label: "Open job issues", count: activeIssueCount, hint: `${activeJobs.length} active job${activeJobs.length === 1 ? "" : "s"}`, action: onOpenActiveJobs },
    canAccessInvoices ? { key: "invoices", label: "Invoice actions", count: invoiceAttentionCount, hint: "Ready, blocked, or failed", action: onOpenInvoices } : null,
    canManageCompliance ? { key: "vendors", label: "Vendor compliance", count: expiringComplianceCount, hint: "Expired or due within 30 days", action: onOpenVendors } : null,
  ].filter(Boolean);

  return (
    <section className="dashboardTasksPanel" aria-labelledby="dashboard-tasks-title">
      <div className="dashboardTasksHeader">
        <div>
          <p className="eyebrow">Today</p>
          <h2 id="dashboard-tasks-title">Attention Center</h2>
          <p>Items that may need action, gathered in one place.</p>
        </div>
        <div className="dashboardTasksHeaderActions">
          <div className={`dashboardTaskBadge ${unreadCount ? "hasNew" : ""}`} aria-label={`${unreadCount} new task${unreadCount === 1 ? "" : "s"}`}>
            <span aria-hidden="true">T</span>
            <strong>{unreadCount}</strong>
            <small>{unreadCount === 1 ? "new task" : "new tasks"}</small>
          </div>
          <button type="button" className="secondaryButton" onClick={() => openTaskWorkspace("")}>View all tasks</button>
        </div>
      </div>

      <div className="dashboardAttentionGrid" aria-label="Items needing attention">
        {attentionItems.map((item) => (
          <button type="button" className={`dashboardAttentionCard ${item.count ? "needsAttention" : ""}`} key={item.key} onClick={item.action}>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
            <small>{item.count ? item.hint : "Nothing waiting"}</small>
          </button>
        ))}
      </div>

      {loading ? <p className="emptyState">Loading your tasks…</p> : null}
      {!loading && tasks.length ? (
        <div className="dashboardTaskList" aria-label="Assigned task preview">
          {tasks.slice(0, 4).map((task) => (
            <button type="button" className={`dashboardTaskRow ${unreadTaskIds.has(task.id) ? "newTask" : ""}`} key={task.id} onClick={() => openTaskWorkspace(task.id)}>
              <span className={`dashboardTaskPriority ${task.priority}`}>{task.priority}</span>
              <span className="dashboardTaskCopy"><strong>{task.title}</strong><small>{task.description || "No description"}</small></span>
              <span className="dashboardTaskDue">{formatDueDate(task.due_date)}</span>
              <span className="dashboardTaskStatus">{taskStatusLabel(task)}</span>
            </button>
          ))}
        </div>
      ) : null}
      {!loading && !tasks.length ? <p className="emptyState">You have no open assigned tasks.</p> : null}
    </section>
  );
}
