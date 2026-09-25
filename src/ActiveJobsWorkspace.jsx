export default function ActiveJobsWorkspace({ workspace }) {
 const { ACTIVE_JOB_RISK_LEVELS, ACTIVE_JOB_STATUS_OPTIONS, DetailRow, Field, LOGO_SRC, Section, activeJobMutationKey, activeJobs, activeJobsFilters, activeJobsSearch, activeJobsSummary, archivedJobs, archivedJobsCollapsed, authUser, canManageSharedJobData, canSubmitInvoiceHandoff, css, filteredActiveJobs, getAccountTitle, getActiveJobOpenIssuesCount, handleArchiveActiveJob, handleRestoreArchivedJob, isActiveJobStatus, jobsSyncError, jobsSyncStatus, num, openActiveJobDetail, openActiveJobIssueModal, openInvoiceHandoff, renderActiveJobIssueModal, renderInvoiceHandoffModal, selectedActiveJob, setActiveJobsFilters, setActiveJobsSearch, setActiveTemplate, setArchivedJobsCollapsed, updateActiveJobsFilter } = workspace;

    const statusCounts = ACTIVE_JOB_STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = activeJobs.filter((job) => String(job.status || "") === status).length;
      return acc;
    }, {});

    return (
      <div className="appShell">
        <style>{css}</style>
        <header className="hero">
          <div>

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
                {jobsSyncStatus === "error" ? (jobsSyncError || "Could not retrieve the latest shared jobs.") : "Active jobs are loaded from shared company workflow records."}
              </p>
            </div>
          ) : null}
            <div className="brandRow">
              <div className="brandMark">
                <img src={LOGO_SRC} alt="CRT Roofing logo" />
              </div>
              <div>
                <p className="eyebrow">CRT Roofing Project Center</p>
                <h1>Active Jobs</h1>
                <p className="intro">Track project status, risk, contacts, open issues, and field progress.</p>
              </div>
            </div>
          </div>

          <div className="heroCard">
            <span>Signed in</span>
            <strong>{authUser.displayName}</strong>
            <p>{getAccountTitle()}</p>
          </div>
        </header>

        <div className="actionRow" style={{ marginBottom: 16 }}>
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
            Back to dashboard
          </button>
          <button
            type="button"
            className="primaryButton"
            onClick={() => openActiveJobIssueModal(selectedActiveJob || filteredActiveJobs[0] || activeJobs[0])}
          >
            Report Issue
          </button>
        </div>

        <Section title="Active jobs list" subtitle="Search, filter, sort, and open a job detail page.">
          <div className="formGrid">
            <Field label="Search">
              <input
                type="search"
                value={activeJobsSearch}
                onChange={(e) => setActiveJobsSearch(e.target.value)}
                placeholder="Search by job, customer, contact, phase, or issue"
              />
            </Field>
            <Field label="Status">
              <select value={activeJobsFilters.status} onChange={(e) => updateActiveJobsFilter("status", e.target.value)}>
                <option value="all">All</option>
                {ACTIVE_JOB_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </Field>
            <Field label="Risk level">
              <select value={activeJobsFilters.riskLevel} onChange={(e) => updateActiveJobsFilter("riskLevel", e.target.value)}>
                <option value="all">All</option>
                {ACTIVE_JOB_RISK_LEVELS.map((riskLevel) => (
                  <option key={riskLevel} value={riskLevel}>{riskLevel}</option>
                ))}
              </select>
            </Field>
            <Field label="Contact">
              <input type="text" value={activeJobsFilters.contact} onChange={(e) => updateActiveJobsFilter("contact", e.target.value)} placeholder="Project contact" />
            </Field>
            <Field label="Supervisor">
              <input type="text" value={activeJobsFilters.supervisor} onChange={(e) => updateActiveJobsFilter("supervisor", e.target.value)} placeholder="Field supervisor" />
            </Field>
            <Field label="Customer">
              <input type="text" value={activeJobsFilters.customer} onChange={(e) => updateActiveJobsFilter("customer", e.target.value)} placeholder="Customer or owner" />
            </Field>
            <Field label="Start date after">
              <input type="date" value={activeJobsFilters.startDate} onChange={(e) => updateActiveJobsFilter("startDate", e.target.value)} />
            </Field>
            <Field label="Open issues">
              <select value={activeJobsFilters.openIssues} onChange={(e) => updateActiveJobsFilter("openIssues", e.target.value)}>
                <option value="all">All</option>
                <option value="yes">Has open issues</option>
                <option value="no">No open issues</option>
              </select>
            </Field>
            <Field label="Sort by">
              <select value={activeJobsFilters.sortBy} onChange={(e) => updateActiveJobsFilter("sortBy", e.target.value)}>
                <option value="startDate">Start date</option>
                <option value="status">Status</option>
                <option value="riskLevel">Risk level</option>
                <option value="customer">Customer</option>
                <option value="openIssues">Open issues</option>
              </select>
            </Field>
            <Field label="Sort order">
              <select value={activeJobsFilters.sortDirection} onChange={(e) => updateActiveJobsFilter("sortDirection", e.target.value)}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </Field>
          </div>

          <div className="actionRow" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="secondaryButton"
              onClick={() => {
                setActiveJobsSearch("");
                setActiveJobsFilters({
                  status: "all",
                  contact: "",
                  supervisor: "",
                  riskLevel: "all",
                  startDate: "",
                  customer: "",
                  openIssues: "all",
                  sortBy: "startDate",
                  sortDirection: "asc",
                });
              }}
            >
              Clear filters
            </button>
          </div>

          <div className="detailList" style={{ marginTop: 14 }}>
            <DetailRow label="Tracked projects" value={num(activeJobs.length, 0)} />
            <DetailRow label="Active / in-progress" value={num(activeJobsSummary.activeCount, 0)} />
            <DetailRow label="Critical risk" value={num(activeJobsSummary.criticalCount, 0)} />
            <DetailRow label="Filtered results" value={num(filteredActiveJobs.length, 0)} />
          </div>

          <div className="activeJobsTableWrap" style={{ marginTop: 14 }}>
            <table className="activeJobsTable">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Job number</th>
                  <th>Project name</th>
                  <th>Customer / property</th>
                  <th>Current phase</th>
                  <th>Project contact</th>
                  <th>Field supervisor</th>
                  <th>Start date</th>
                  <th>Expected completion</th>
                  <th>Risk / issue</th>
                  <th>Open issues</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredActiveJobs.length ? (
                  filteredActiveJobs.map((job) => {
                    const openIssues = getActiveJobOpenIssuesCount(job);
                    const statusTone = String(job.statusTone || "").toLowerCase() || (isActiveJobStatus(job.status) ? "green" : "blue");
                    const riskTone = String(job.riskTone || "").toLowerCase() || (String(job.riskLevel || "").toLowerCase() === "critical" ? "red" : "yellow");
                    return (
                      <tr key={job.id} className="activeJobsRow" onClick={() => openActiveJobDetail(job.id)}>
                        <td>
                          <span className={`activeJobsStatusDot ${statusTone}`} aria-hidden="true" />
                          {job.status || "Active"}
                        </td>
                        <td>{job.jobNumber || "—"}</td>
                        <td>{job.projectName || "Untitled project"}</td>
                        <td>{job.customer || job.propertyOwner || "—"}</td>
                        <td>{job.currentPhase || "—"}</td>
                        <td>{job.projectContact || "—"}</td>
                        <td>{job.fieldSupervisor || "—"}</td>
                        <td>{job.startDate || "—"}</td>
                        <td>{job.expectedCompletionDate || "—"}</td>
                        <td>
                          <span className={`activeJobsStatusDot ${riskTone}`} aria-hidden="true" />
                          {job.riskLevel || "Normal"}
                        </td>
                        <td>{num(openIssues, 0)}</td>
                        <td>
                          <div className="savedActions">
                            <button type="button" className="secondaryButton" onClick={(e) => { e.stopPropagation(); openActiveJobDetail(job.id); }}>
                              Open
                            </button>
                            <button type="button" className="secondaryButton" onClick={(e) => { e.stopPropagation(); openActiveJobIssueModal(job); }}>
                              Report Issue
                            </button>
                            {canSubmitInvoiceHandoff ? (
                              <button type="button" className="primaryButton" onClick={(e) => { e.stopPropagation(); openInvoiceHandoff(job); }}>
                                Complete &amp; Invoice
                              </button>
                            ) : null}
                            {canManageSharedJobData ? (
                              <button type="button" className="secondaryButton" disabled={Boolean(activeJobMutationKey)} onClick={(e) => { e.stopPropagation(); handleArchiveActiveJob(job); }}>
                                {activeJobMutationKey === `archive:${job.id}` ? "Archiving…" : "Archive"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={12}>
                      <div className="cfoDetailEmpty">
                        <strong>No active jobs match the current filters.</strong>
                        <p style={{ margin: "8px 0 0", color: "#a7c7d6" }}>
                          Clear the filters or add a project to the active jobs list.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title={`Archived jobs (${archivedJobs.length})`}
          subtitle="Company job archive. Restoring a job returns it to its previous workflow section."
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
            <div className="activeJobsTableWrap">
              <table className="activeJobsTable" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Job number</th>
                    <th>Project name</th>
                    <th>Customer / property</th>
                    <th>Previous status</th>
                    <th>Archived</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedJobs.map((job) => (
                    <tr key={job.id}>
                      <td>{job.jobNumber || "—"}</td>
                      <td>{job.projectName || "Untitled project"}</td>
                      <td>{job.customer || job.propertyOwner || "—"}</td>
                      <td>{job.status || job.projectStatus || "—"}</td>
                      <td>{job.archivedAt ? new Date(job.archivedAt).toLocaleString() : "—"}</td>
                      <td>
                        {canManageSharedJobData ? (
                          <button type="button" className="secondaryButton" disabled={Boolean(activeJobMutationKey)} onClick={() => handleRestoreArchivedJob(job)}>
                            {activeJobMutationKey === `restore:${job.id}` ? "Restoring…" : "Restore"}
                          </button>
                        ) : (
                          <span>View only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="emptyState">No archived jobs yet.</p>
          )}
        </Section>

        <Section title="Status breakdown" subtitle="A quick snapshot of project stage counts.">
          <div className="summaryGrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 0 }}>
            {ACTIVE_JOB_STATUS_OPTIONS.map((status) => (
              <div className="summaryCard" key={status}>
                <span>{status}</span>
                <strong>{num(statusCounts[status] || 0, 0)}</strong>
                <p>Projects in this phase.</p>
              </div>
            ))}
          </div>
        </Section>

        {renderActiveJobIssueModal()}
        {renderInvoiceHandoffModal()}
      </div>
    );
  
}
