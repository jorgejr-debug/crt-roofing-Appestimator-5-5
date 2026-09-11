import { useCallback, useEffect, useMemo, useState } from "react";
import "./WorkHub.css";
import { TASK_DELETE_CONFIRMATION, canDeleteTask } from "./taskDeletion.js";
import { isTaskClosed, taskMatchesView, taskStatusLabel, taskType, taskTypeLabel } from "./taskStatus.js";
import ProposalRequests from "./ProposalRequests.jsx";

const PROFILE_BUCKET = "profile-photos";

function initials(profile = {}) {
  const name = String(profile.full_name || profile.email || "Employee").trim();
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CR";
}

function displayName(profile = {}) {
  const savedName = String(profile.full_name || "").trim();
  if (savedName && !savedName.includes("@")) return savedName;
  const emailName = String(profile.email || "").split("@")[0].trim();
  if (!emailName) return "Employee";
  const readableName = emailName
    .replace(/([a-z])(jr|sr)$/i, "$1 $2")
    .split(/[._-]+|\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
  return readableName || "Employee";
}

function displayRole(role) {
  const value = String(role || "Employee").trim();
  if (value.toLowerCase() === "cfo") return "CFO";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatDate(value) {
  if (!value) return "No due date";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function PersonAvatar({ profile, size = "normal" }) {
  return (
    <span className={`workHubAvatar ${size === "small" ? "small" : ""}`} aria-hidden="true">
      {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials(profile)}
    </span>
  );
}

export default function WorkHub({ supabase, authUser, initialTab = "tasks", initialTaskId = "", initialCreateTask = false }) {
  const authUserKey = authUser?.key;
  const [activeTab, setActiveTab] = useState(initialTaskId ? "tasks" : initialTab);
  const [profiles, setProfiles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [comments, setComments] = useState([]);
  const [taskNotifications, setTaskNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState(initialTaskId);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [taskDraft, setTaskDraft] = useState({ title: "", description: "", dueDate: "", priority: "normal", assigneeIds: [] });
  const [commentDraft, setCommentDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState("");
  const [search, setSearch] = useState("");
  const [taskView, setTaskView] = useState("active");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [showCreateTask, setShowCreateTask] = useState(Boolean(initialCreateTask));
  const [taskNotice, setTaskNotice] = useState("");

  const profileById = useMemo(() => Object.fromEntries(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;
  const selectedPerson = profileById[selectedPersonId] || null;

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    if (!authUserKey) return;
    if (!quiet) setLoading(true);
    setError("");
    const [profileResult, taskResult, assigneeResult, commentResult, notificationResult, messageResult] = await Promise.all([
      supabase.from("user_profiles").select("id, full_name, email, role, avatar_path").order("full_name"),
      supabase.from("company_tasks").select("*").order("updated_at", { ascending: false }),
      supabase.from("company_task_assignees").select("*").order("assigned_at", { ascending: true }),
      supabase.from("company_task_comments").select("*").order("created_at", { ascending: true }),
      supabase.from("company_task_notifications").select("id, task_id, notification_type, source_comment_id, created_at, read_at").eq("user_id", authUserKey).order("created_at", { ascending: false }).limit(250),
      supabase.from("company_messages").select("*").or(`sender_id.eq.${authUserKey},recipient_id.eq.${authUserKey}`).order("created_at", { ascending: true }),
    ]);
    const firstError = [profileResult.error, taskResult.error, assigneeResult.error, commentResult.error, notificationResult.error, messageResult.error].find(Boolean);
    if (firstError) {
      setError(firstError.message || "Unable to load collaboration data.");
      setLoading(false);
      return;
    }
    const signedProfiles = await Promise.all((profileResult.data || []).map(async (profile) => {
      if (!profile.avatar_path) return { ...profile, avatarUrl: "" };
      const { data } = await supabase.storage.from(PROFILE_BUCKET).createSignedUrl(profile.avatar_path, 60 * 60 * 24);
      return { ...profile, avatarUrl: data?.signedUrl || "" };
    }));
    setProfiles(signedProfiles);
    setTasks(taskResult.data || []);
    setAssignees(assigneeResult.data || []);
    setComments(commentResult.data || []);
    setTaskNotifications(notificationResult.data || []);
    setMessages(messageResult.data || []);
    setSelectedPersonId((current) => current || signedProfiles.find((profile) => profile.id !== authUserKey)?.id || "");
    setLoading(false);
  }, [authUserKey, supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadData(); }, 0);
    if (!authUserKey) return () => window.clearTimeout(initialLoad);
    const channel = supabase
      .channel(`work-hub-${authUserKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "company_tasks" }, () => loadData({ quiet: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "company_task_assignees" }, () => loadData({ quiet: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "company_task_comments" }, () => loadData({ quiet: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "company_task_notifications", filter: `user_id=eq.${authUserKey}` }, () => loadData({ quiet: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "company_messages" }, () => loadData({ quiet: true }))
      .subscribe();
    return () => {
      window.clearTimeout(initialLoad);
      supabase.removeChannel(channel);
    };
  }, [authUserKey, loadData, supabase]);

  const taskAssignees = useCallback((taskId) => assignees.filter((entry) => entry.task_id === taskId).map((entry) => profileById[entry.user_id]).filter(Boolean), [assignees, profileById]);
  const myTasks = useMemo(() => tasks.filter((task) => task.created_by === authUser.key || assignees.some((entry) => entry.task_id === task.id && entry.user_id === authUser.key)), [assignees, authUser.key, tasks]);
  const visibleTasks = myTasks.filter((task) => taskMatchesView(task, taskView) && (taskTypeFilter === "all" || taskType(task) === taskTypeFilter));
  const filteredTasks = visibleTasks.filter((task) => [task.title, task.description, task.related_label].join(" ").toLowerCase().includes(search.trim().toLowerCase()));
  const unreadMessages = messages.filter((message) => message.recipient_id === authUser.key && !message.read_at).length;
  const openMyTasks = myTasks.filter((task) => !isTaskClosed(task)).length;
  const unreadByTask = useMemo(() => taskNotifications.filter((item) => !item.read_at).reduce((counts, item) => ({ ...counts, [item.task_id]: (counts[item.task_id] || 0) + 1 }), {}), [taskNotifications]);
  const taskComments = comments.filter((comment) => comment.task_id === selectedTaskId);
  const conversation = selectedPersonId ? messages.filter((message) =>
    (message.sender_id === authUser.key && message.recipient_id === selectedPersonId) ||
    (message.sender_id === selectedPersonId && message.recipient_id === authUser.key)) : [];

  const toggleAssignee = (userId) => {
    setTaskDraft((current) => ({
      ...current,
      assigneeIds: current.assigneeIds.includes(userId) ? current.assigneeIds.filter((id) => id !== userId) : [...current.assigneeIds, userId],
    }));
  };

  const createTask = async (event) => {
    event.preventDefault();
    if (!taskDraft.title.trim() || saving) return;
    setSaving(true);
    setError("");
    const { data: task, error: taskError } = await supabase.rpc("create_private_company_task", {
      p_title: taskDraft.title.trim(),
      p_description: taskDraft.description.trim(),
      p_due_date: taskDraft.dueDate || null,
      p_priority: taskDraft.priority,
      p_assignee_ids: taskDraft.assigneeIds,
    }).single();
    if (taskError) {
      setError(taskError.message);
      setSaving(false);
      return;
    }
    setTaskDraft({ title: "", description: "", dueDate: "", priority: "normal", assigneeIds: [] });
    setSelectedTaskId(task.id);
    setShowCreateTask(false);
    setTaskNotice("Task created.");
    setSaving(false);
    await loadData({ quiet: true });
  };

  const updateTaskStatus = async (task, status) => {
    if (status === "voided" && !window.confirm("Mark this task as voided? It will leave the active list but remain available in task history.")) return;
    setError("");
    setTaskNotice("");
    const { error: updateError } = await supabase.from("company_tasks").update({ status }).eq("id", task.id);
    if (updateError) setError(updateError.message);
    else {
      const label = taskStatusLabel({ ...task, status });
      setTaskNotice(isTaskClosed({ status }) ? `Task marked ${label.toLowerCase()} and moved to task history.` : `Task status updated to ${label}.`);
      if (taskView === "active" && isTaskClosed({ status })) setSelectedTaskId("");
      await loadData({ quiet: true });
    }
  };

  const openTask = async (taskId) => {
    setSelectedTaskId(taskId);
    const unreadIds = taskNotifications.filter((item) => item.task_id === taskId && !item.read_at).map((item) => item.id);
    if (!unreadIds.length) return;
    const readAt = new Date().toISOString();
    setTaskNotifications((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, read_at: readAt } : item));
    await supabase.from("company_task_notifications").update({ read_at: readAt }).eq("user_id", authUserKey).eq("task_id", taskId).is("read_at", null);
  };

  const deleteTask = async (task) => {
    if (!canDeleteTask(task, authUserKey) || deletingTaskId) return;
    if (!window.confirm(TASK_DELETE_CONFIRMATION)) return;

    setDeletingTaskId(task.id);
    setError("");
    const { data: deletedRows, error: deleteError } = await supabase
      .from("company_tasks")
      .delete()
      .eq("id", task.id)
      .eq("created_by", authUserKey)
      .select("id");

    if (deleteError) {
      setError(deleteError.message || "Unable to delete this task.");
      setDeletingTaskId("");
      return;
    }
    if (!deletedRows?.length) {
      setError("This task could not be deleted. Only its creator can delete it.");
      setDeletingTaskId("");
      return;
    }

    setTasks((current) => current.filter((item) => item.id !== task.id));
    setSelectedTaskId((current) => (current === task.id ? "" : current));
    setDeletingTaskId("");
    await loadData({ quiet: true });
  };

  const addComment = async (event) => {
    event.preventDefault();
    if (!commentDraft.trim() || !selectedTaskId || saving) return;
    setSaving(true);
    const { error: commentError } = await supabase.from("company_task_comments").insert({ task_id: selectedTaskId, author_id: authUser.key, body: commentDraft.trim() });
    if (commentError) setError(commentError.message);
    else setCommentDraft("");
    setSaving(false);
    await loadData({ quiet: true });
  };

  const openConversation = async (personId) => {
    setSelectedPersonId(personId);
    setActiveTab("messages");
    await supabase.from("company_messages").update({ read_at: new Date().toISOString() }).eq("sender_id", personId).eq("recipient_id", authUser.key).is("read_at", null);
    await loadData({ quiet: true });
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!messageDraft.trim() || !selectedPersonId || saving) return;
    setSaving(true);
    const { error: messageError } = await supabase.from("company_messages").insert({ sender_id: authUser.key, recipient_id: selectedPersonId, body: messageDraft.trim() });
    if (messageError) setError(messageError.message);
    else setMessageDraft("");
    setSaving(false);
    await loadData({ quiet: true });
  };

  const assignPerson = (personId) => {
    setTaskDraft((current) => ({ ...current, assigneeIds: [personId] }));
    setShowCreateTask(true);
    setActiveTab("tasks");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="appShell workHub">
      <header className="workHubHeader">
        <div><p className="eyebrow">Collaboration</p><h1>Tasks & Messages</h1><p className="intro">Assign work, discuss projects, and reach your team from one place.</p></div>
        <div className="workHubStats">
          <div><span>My open tasks</span><strong>{openMyTasks}</strong></div>
          <div><span>Unread messages</span><strong>{unreadMessages}</strong></div>
          <div><span>Team members</span><strong>{profiles.length}</strong></div>
        </div>
      </header>

      <div className="workHubTabs" role="tablist">
        <button type="button" className={activeTab === "tasks" ? "active" : ""} onClick={() => setActiveTab("tasks")}>Tasks</button>
        <button type="button" className={activeTab === "proposals" ? "active" : ""} onClick={() => setActiveTab("proposals")}>Proposal Requests</button>
        <button type="button" className={activeTab === "messages" ? "active" : ""} onClick={() => setActiveTab("messages")}>Messages {unreadMessages ? `(${unreadMessages})` : ""}</button>
        <button type="button" className={activeTab === "people" ? "active" : ""} onClick={() => setActiveTab("people")}>People</button>
      </div>

      {error ? <p className="statusMessage dangerMessage">{error}</p> : null}
      {taskNotice ? <p className="statusMessage successMessage">{taskNotice}</p> : null}
      {loading ? <section className="panel"><p className="emptyState">Loading collaboration workspace…</p></section> : null}

      {!loading && activeTab === "tasks" ? (
        <>
          <div className="workHubTaskToolbar">
            <div>
              <strong>{filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"} in this view</strong>
              <span>Past-due tasks are identified automatically from their due date.</span>
            </div>
            <button type="button" className={showCreateTask ? "secondaryButton" : "primaryButton"} onClick={() => setShowCreateTask((current) => !current)}>
              {showCreateTask ? "Cancel New Task" : "New Task"}
            </button>
          </div>
          <div className={`workHubColumns ${showCreateTask ? "" : "withoutCreator"} ${selectedTask ? "hasSelection" : ""}`}>
          {showCreateTask ? <section className="panel workHubCreator">
            <div className="sectionHead"><div><h2>Create Task</h2><p>Assign work to one or more employees.</p></div></div>
            <form className="workHubForm" onSubmit={createTask}>
              <label><span>Task title</span><input value={taskDraft.title} onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))} placeholder="What needs to be done?" required /></label>
              <label><span>Description</span><textarea rows="3" value={taskDraft.description} onChange={(event) => setTaskDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Scope, instructions, or context" /></label>
              <div className="workHubFormRow">
                <label><span>Due date</span><input type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label>
                <label><span>Priority</span><select value={taskDraft.priority} onChange={(event) => setTaskDraft((current) => ({ ...current, priority: event.target.value }))}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
              </div>
              <fieldset className="workHubPeoplePicker"><legend>Assign to</legend>{profiles.map((profile) => (
                <label key={profile.id} className={taskDraft.assigneeIds.includes(profile.id) ? "selected" : ""}><input type="checkbox" checked={taskDraft.assigneeIds.includes(profile.id)} onChange={() => toggleAssignee(profile.id)} /><PersonAvatar profile={profile} size="small" /><span>{displayName(profile)}</span></label>
              ))}</fieldset>
              <button type="submit" className="primaryButton" disabled={saving}>{saving ? "Creating…" : "Create Task"}</button>
            </form>
          </section> : null}

          <section className="panel workHubTaskBrowser">
            <div className="sectionHead"><div><h2>My Tasks</h2><p>Only tasks you created or were assigned to appear here.</p></div></div>
            <div className="workHubTaskFilters">
              <input className="workHubSearch" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks" />
              <select aria-label="Task status" value={taskView} onChange={(event) => setTaskView(event.target.value)}>
                <option value="active">Active</option>
                <option value="past_due">Past due</option>
                <option value="completed">Completed history</option>
                <option value="voided">Voided history</option>
                <option value="all">All tasks</option>
              </select>
              <select aria-label="Task type" value={taskTypeFilter} onChange={(event) => setTaskTypeFilter(event.target.value)}>
                <option value="all">All types</option>
                <option value="general">General tasks</option>
                <option value="payment_follow_up">Payment follow-ups</option>
                <option value="proposal_request">Proposal requests</option>
              </select>
            </div>
            <div className="workHubTaskList">
              {filteredTasks.map((task) => (
                <article key={task.id} className={`workHubTask ${selectedTaskId === task.id ? "selected" : ""}`}>
                  <button type="button" className="workHubTaskOpen" onClick={() => openTask(task.id)}>
                    <div className="workHubTaskTop">
                      <span className="workHubTaskTitle"><span className={`workHubTypeBadge ${taskType(task)}`}>{taskTypeLabel(task)}</span><strong>{task.title}</strong></span>
                      <span className={`workHubPriority ${task.priority}`}>{task.priority}</span>
                    </div>
                    <div className="workHubTaskMeta">
                      <span>{formatDate(task.due_date)}</span>
                      <span className={taskMatchesView(task, "past_due") ? "pastDue" : ""}>{taskStatusLabel(task)}</span>
                      {unreadByTask[task.id] ? <b className="workHubUnreadBadge">{unreadByTask[task.id]} new</b> : null}
                    </div>
                  </button>
                  <div className="workHubTaskFooter">
                    <div className="workHubAvatarStack">{taskAssignees(task.id).map((profile) => <PersonAvatar key={profile.id} profile={profile} size="small" />)}</div>
                    {canDeleteTask(task, authUserKey) ? (
                      <button
                        type="button"
                        className="workHubTaskDelete"
                        disabled={deletingTaskId === task.id}
                        onClick={() => deleteTask(task)}
                      >
                        {deletingTaskId === task.id ? "Deleting…" : "Delete"}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {!filteredTasks.length ? <p className="emptyState">No tasks match this view.</p> : null}
            </div>
          </section>

          <section className="panel workHubDiscussion">
            <button type="button" className="secondaryButton workHubMobileBack" onClick={() => setSelectedTaskId("")}>Back to task list</button>
            <div className="sectionHead workHubDiscussionHeader"><div><h2>Task Discussion</h2><p>Comments and status updates stay attached to the work.</p></div></div>
            {selectedTask ? <>
              <div className="workHubDiscussionTitle"><span className={`workHubTypeBadge ${taskType(selectedTask)}`}>{taskTypeLabel(selectedTask)}</span><h3>{selectedTask.title}</h3></div>
              {selectedTask.description ? <p className="workHubTaskDescription">{selectedTask.description}</p> : null}
              <div className="workHubQuickStatuses" aria-label="Quick task actions">
                <button type="button" className="secondaryButton" onClick={() => updateTaskStatus(selectedTask, "in_progress")}>Working on It</button>
                <button type="button" className="secondaryButton successAction" onClick={() => updateTaskStatus(selectedTask, "completed")}>Completed</button>
                <button type="button" className="secondaryButton voidAction" onClick={() => updateTaskStatus(selectedTask, "voided")}>Voided</button>
              </div>
              <label className="workHubStatusField"><span>Status</span><select className="workHubStatusSelect" value={selectedTask.status} onChange={(event) => updateTaskStatus(selectedTask, event.target.value)}><option value="open">Open</option><option value="in_progress">Working on It</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="voided">Voided</option></select></label>
              <div className="workHubComments">{taskComments.map((comment) => <div key={comment.id} className="workHubComment"><PersonAvatar profile={profileById[comment.author_id]} size="small" /><div><strong>{displayName(profileById[comment.author_id])}</strong><p>{comment.body}</p><small>{new Date(comment.created_at).toLocaleString()}</small></div></div>)}{!taskComments.length ? <p className="emptyState">No comments yet.</p> : null}</div>
              <form className="workHubComposer" onSubmit={addComment}><textarea rows="3" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add a comment or update" /><button type="submit" className="primaryButton" disabled={saving || !commentDraft.trim()}>Comment</button></form>
            </> : <p className="emptyState">Select a task to open its discussion.</p>}
          </section>
        </div>
        </>
      ) : null}

      {!loading && activeTab === "proposals" ? <ProposalRequests supabase={supabase} authUser={authUser} profiles={profiles} /> : null}

      {!loading && activeTab === "messages" ? (
        <div className="workHubMessaging">
          <section className="panel workHubContacts"><div className="sectionHead"><div><h2>Team</h2><p>Select someone to message.</p></div></div>{profiles.filter((profile) => profile.id !== authUser.key).map((profile) => {
            const personUnread = messages.filter((message) => message.sender_id === profile.id && message.recipient_id === authUser.key && !message.read_at).length;
            return <button type="button" key={profile.id} className={selectedPersonId === profile.id ? "selected" : ""} onClick={() => openConversation(profile.id)}><PersonAvatar profile={profile} /><span><strong>{displayName(profile)}</strong><small>{displayRole(profile.role)}</small></span>{personUnread ? <b>{personUnread}</b> : null}</button>;
          })}</section>
          <section className="panel workHubConversation">
            {selectedPerson ? <><div className="workHubConversationHeader"><PersonAvatar profile={selectedPerson} /><div><h2>{displayName(selectedPerson)}</h2><p>{selectedPerson.email}</p></div><a className="secondaryButton workHubEmailLink" href={`mailto:${encodeURIComponent(selectedPerson.email || "")}`}>Email</a></div>
              <div className="workHubMessageList">{conversation.map((message) => <div key={message.id} className={`workHubMessage ${message.sender_id === authUser.key ? "mine" : "theirs"}`}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>)}{!conversation.length ? <p className="emptyState">Start the conversation.</p> : null}</div>
              <form className="workHubComposer" onSubmit={sendMessage}><textarea rows="3" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder={`Message ${displayName(selectedPerson)}`} /><button type="submit" className="primaryButton" disabled={saving || !messageDraft.trim()}>Send</button></form>
            </> : <p className="emptyState">Choose a team member to begin.</p>}
          </section>
        </div>
      ) : null}

      {!loading && activeTab === "people" ? (
        <section className="panel workHubDirectoryPanel"><div className="sectionHead"><div><h2>Company Directory</h2><p>Select a teammate to assign work, start a conversation, or send an email.</p></div></div><div className="workHubDirectory">{profiles.map((profile) => <article key={profile.id} className="workHubPersonCard"><div className="workHubPersonIdentity"><PersonAvatar profile={profile} /><div className="workHubPersonDetails"><strong>{displayName(profile)}</strong><p>{displayRole(profile.role)}</p><a href={`mailto:${encodeURIComponent(profile.email || "")}`}>{profile.email}</a></div>{profile.id === authUser.key ? <span className="statusTag">You</span> : null}</div>{profile.id !== authUser.key ? <div className="workHubPersonActions"><button type="button" className="secondaryButton" onClick={() => assignPerson(profile.id)}>Assign Task</button><button type="button" className="secondaryButton" onClick={() => openConversation(profile.id)}>Message</button><a className="secondaryButton" href={`mailto:${encodeURIComponent(profile.email || "")}`}>Email</a></div> : null}</article>)}</div></section>
      ) : null}
    </div>
  );
}
