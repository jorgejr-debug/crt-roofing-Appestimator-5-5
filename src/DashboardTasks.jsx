import { useCallback, useEffect, useMemo, useState } from "react";
import "./DashboardTasks.css";
import { taskStatusLabel } from "./taskStatus.js";

function formatDueDate(value) {
  if (!value) return "No due date";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DashboardTasks({ supabase, authUser, onOpenTasks }) {
  const authUserKey = authUser?.key;
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardTasks = useCallback(async ({ quiet = false } = {}) => {
    if (!authUserKey) return;
    if (!quiet) setLoading(true);
    const [taskResult, notificationResult] = await Promise.all([
      supabase.from("company_tasks").select("id, title, description, status, priority, due_date, created_by, created_at, updated_at").not("status", "in", '("completed","voided")').order("due_date", { ascending: true, nullsFirst: false }).limit(8),
      supabase.from("company_task_notifications").select("id, task_id, created_at, read_at").eq("user_id", authUserKey).order("created_at", { ascending: false }).limit(50),
    ]);
    if (!taskResult.error) setTasks(taskResult.data || []);
    if (!notificationResult.error) setNotifications(notificationResult.data || []);
    setLoading(false);
  }, [authUserKey, supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadDashboardTasks(); }, 0);
    if (!authUserKey) return () => window.clearTimeout(initialLoad);
    const channel = supabase
      .channel(`dashboard-tasks-${authUserKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "company_tasks" }, () => loadDashboardTasks({ quiet: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "company_task_assignees" }, () => loadDashboardTasks({ quiet: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "company_task_notifications", filter: `user_id=eq.${authUserKey}` }, () => loadDashboardTasks({ quiet: true }))
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

  return (
    <section className="dashboardTasksPanel" aria-labelledby="dashboard-tasks-title">
      <div className="dashboardTasksHeader">
        <div>
          <p className="eyebrow">My work</p>
          <h2 id="dashboard-tasks-title">Assigned Tasks</h2>
          <p>Tasks you created or were assigned to.</p>
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

      {loading ? <p className="emptyState">Loading your tasks…</p> : null}
      {!loading && tasks.length ? (
        <div className="dashboardTaskList">
          {tasks.map((task) => (
            <button type="button" className={`dashboardTaskRow ${unreadTaskIds.has(task.id) ? "newTask" : ""}`} key={task.id} onClick={() => openTaskWorkspace(task.id)}>
              <span className={`dashboardTaskPriority ${task.priority}`}>{task.priority}</span>
              <span className="dashboardTaskCopy"><strong>{task.title}</strong><small>{task.description || "No description"}</small></span>
              <span className="dashboardTaskDue">{formatDueDate(task.due_date)}</span>
              <span className="dashboardTaskStatus">{taskStatusLabel(task)}</span>
            </button>
          ))}
        </div>
      ) : null}
      {!loading && !tasks.length ? <p className="emptyState">You have no open tasks.</p> : null}
    </section>
  );
}
