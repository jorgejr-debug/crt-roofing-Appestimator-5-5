export default function ApprovedJobsWorkspace({ workspace }) {
 const { APPROVED_JOB_STATUS_OPTIONS, Field, LOGO_SRC, Section, activeJobMutationKey, approvedJobQuickCreateOpen, approvedJobQuickDraft, archivedJobs, archivedJobsCollapsed, authUser, canCreateApprovedJobData, canManageSharedJobData, css, filteredApprovedJobs, handleApprovedJobQuickDraftChange, handleCreateApprovedJobQuick, handleRestoreArchivedJob, jobsSyncError, jobsSyncStatus, renderApprovedJobsTableSection, sessionMessage, sessionMessageType, setActiveTemplate, setApprovedJobQuickCreateOpen, setArchivedJobsCollapsed } = workspace;
 return (<div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div>
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing Employee Portal</p>
              <h1>Approved Jobs / Upcoming Projects</h1>
              <p className="intro">Manage approved jobs, upcoming projects, and the information the field still needs.</p>
            </div>
          </div>
        </div>

        <div className="heroCard">
          <span>Signed in</span>
          <strong>{authUser.displayName}</strong>
        </div>
      </header>

      <div className="actionRow" style={{ marginBottom: 16 }}>
        <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>Back to dashboard</button>
        {canCreateApprovedJobData ? (
          <button
            type="button"
            className="primaryButton"
            aria-expanded={approvedJobQuickCreateOpen}
            onClick={() => setApprovedJobQuickCreateOpen((current) => !current)}
          >
            {approvedJobQuickCreateOpen ? "Close Add Approved Job" : "Add Approved Job"}
          </button>
        ) : null}
      </div>

      {approvedJobQuickCreateOpen ? (
        <Section title="Add Approved Job" subtitle="Create an approved or upcoming project without opening the CFO dashboard.">
          <div className="formGrid">
            <Field label="Job number / project">
              <input type="text" value={approvedJobQuickDraft.projectName} onChange={(e) => handleApprovedJobQuickDraftChange("projectName", e.target.value)} placeholder="Job number or project name" />
            </Field>
            <Field label="Customer / homeowner">
              <input type="text" value={approvedJobQuickDraft.customerName} onChange={(e) => handleApprovedJobQuickDraftChange("customerName", e.target.value)} placeholder="Customer or homeowner name" />
            </Field>
            <Field label="Project address">
              <input type="text" value={approvedJobQuickDraft.projectAddress} onChange={(e) => handleApprovedJobQuickDraftChange("projectAddress", e.target.value)} placeholder="Job-site address" />
            </Field>
            <Field label="Approved contract amount">
              <input type="text" inputMode="decimal" value={approvedJobQuickDraft.contractAmount} onChange={(e) => handleApprovedJobQuickDraftChange("contractAmount", e.target.value)} placeholder="$0.00" />
            </Field>
            <Field label="Anticipated start date">
              <input type="date" value={approvedJobQuickDraft.anticipatedStartDate} onChange={(e) => handleApprovedJobQuickDraftChange("anticipatedStartDate", e.target.value)} />
            </Field>
            <Field label="Project contact">
              <input type="text" value={approvedJobQuickDraft.projectContact} onChange={(e) => handleApprovedJobQuickDraftChange("projectContact", e.target.value)} placeholder="Assigned project contact" />
            </Field>
            <Field label="Project status">
              <select value={approvedJobQuickDraft.status} onChange={(e) => handleApprovedJobQuickDraftChange("status", e.target.value)}>
                {APPROVED_JOB_STATUS_OPTIONS.filter((status) => !["Active", "Completed", "Closed"].includes(status)).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="actionRow" style={{ marginTop: 14 }}>
            <button type="button" className="primaryButton" onClick={handleCreateApprovedJobQuick}>Save Approved Job</button>
            <button type="button" className="secondaryButton" onClick={() => setApprovedJobQuickCreateOpen(false)}>Cancel</button>
          </div>
        </Section>
      ) : null}

      {sessionMessage ? (
        <p className={`statusMessage ${sessionMessageType === "error" ? "dangerMessage" : ""}`}>{sessionMessage}</p>
      ) : null}

      {jobsSyncStatus === "loading" || jobsSyncStatus === "refreshing" || jobsSyncStatus === "reconnecting" || jobsSyncStatus === "offline" || jobsSyncStatus === "error" ? (
        <div className="summaryCard" style={{ marginBottom: 16 }}>
          <strong>
            {jobsSyncStatus === "offline"
              ? "You are offline"
              : jobsSyncStatus === "reconnecting"
                ? "Reconnecting to shared jobs"
                : jobsSyncStatus === "error"
                  ? "Shared jobs sync error"
                  : "Loading shared jobs"}
          </strong>
          <p style={{ marginBottom: 0, color: "var(--muted)" }}>
            {jobsSyncStatus === "error" ? (jobsSyncError || "Could not retrieve the latest shared jobs.") : "This screen reflects the shared company job workflow."}
          </p>
        </div>
      ) : null}

      {renderApprovedJobsTableSection({
        title: "Approved Jobs / Upcoming Projects",
        subtitle: "Focus on the next action, schedule, owner, and outstanding checklist items.",
        jobs: filteredApprovedJobs,
        showViewAllButton: false,
        limit: null,
      })}

      <Section
        title={`Archived approved jobs (${archivedJobs.length})`}
        subtitle="Saved job history that can be restored to its previous workflow stage."
        right={(
          <button
            type="button"
            className="secondaryButton"
            aria-expanded={!archivedJobsCollapsed}
            onClick={() => setArchivedJobsCollapsed((value) => !value)}
          >
            {archivedJobsCollapsed ? "Expand" : "Minimize"}
          </button>
        )}
      >
        {archivedJobsCollapsed ? null : archivedJobs.length ? (
          <div className="savedList">
            {archivedJobs.map((job) => (
              <div className="savedCard" key={job.id}>
                <div>
                  <span className="statusTag">Archived</span>
                  <strong>{job.projectName || job.jobName || "Untitled project"}</strong>
                  <p>
                    {job.jobNumber ? `Job ${job.jobNumber} | ` : ""}
                    {job.customerName || job.customer || "No customer"}
                    {job.archivedAt ? ` | ${new Date(job.archivedAt).toLocaleString()}` : ""}
                  </p>
                </div>
                {canManageSharedJobData ? (
                  <div className="savedActions">
                    <button type="button" className="secondaryButton" disabled={Boolean(activeJobMutationKey)} onClick={() => handleRestoreArchivedJob(job)}>
                      {activeJobMutationKey === `restore:${job.id}` ? "Restoring…" : "Restore"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="emptyState">No archived approved jobs yet.</p>
        )}
      </Section>
    </div>); 
}
