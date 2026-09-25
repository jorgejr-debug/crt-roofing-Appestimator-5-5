export default function ActiveJobWorkspace({ workspace }) {
 const { ACTIVE_JOB_RISK_LEVELS, ACTIVE_JOB_STATUS_OPTIONS, DetailRow, Field, LOGO_SRC, Section, activeJobEditDraft, activeJobEditMode, activeJobMutationKey, activeJobs, authUser, canManageActiveJobData, canSubmitInvoiceHandoff, canUpdateDailyJobCostData, css, filteredActiveJobs, getAccountTitle, getActiveJobOpenIssuesCount, handleActiveJobEditFieldChange, handleCancelActiveJobEdit, handleNumberInputWheel, handleSaveActiveJobEdit, handleStartActiveJobEdit, isProjectManager, money2, num, openActiveJobIssueModal, openApprovedJobDetail, openInvoiceHandoff, renderActiveJobIssueModal, renderInvoiceHandoffModal, selectedActiveJob, setActiveTemplate, toNumber } = workspace;

    const project = selectedActiveJob || filteredActiveJobs[0] || activeJobs[0] || null;
    if (!project) {
      return (
        <div className="appShell">
          <style>{css}</style>
          <header className="hero">
            <div>
              <div className="brandRow">
                <div className="brandMark">
                  <img src={LOGO_SRC} alt="CRT Roofing logo" />
                </div>
                <div>
                  <p className="eyebrow">CRT Roofing Project Center</p>
                  <h1>Active Job</h1>
                  <p className="intro">Select a job from the active jobs list.</p>
                </div>
              </div>
            </div>
          </header>
          <div className="actionRow" style={{ marginBottom: 16 }}>
            <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("activeJobs")}>Back to active jobs</button>
            <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>Back to dashboard</button>
          </div>
          <Section title="No project selected" subtitle="Open a job from the active jobs list to view details.">
            <p className="emptyState">No active job available yet.</p>
          </Section>
        </div>
      );
    }

    const openIssues = getActiveJobOpenIssuesCount(project);

    return (
      <div className="appShell">
        <style>{css}</style>
        <header className="hero">
          <div>
            <div className="brandRow">
              <div className="brandMark">
                <img src={LOGO_SRC} alt="CRT Roofing logo" />
              </div>
              <div>
                <p className="eyebrow">CRT Roofing Project Center</p>
                <h1>{project.projectName || "Active Job"}</h1>
                <p className="intro">
                  {project.address || "No property address"} · Job {project.jobNumber || "—"}
                </p>
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
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("activeJobs")}>
            Back to active jobs
          </button>
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
            Back to dashboard
          </button>
          <button type="button" className="primaryButton" onClick={() => openActiveJobIssueModal(project)}>
            Report Issue
          </button>
          {canUpdateDailyJobCostData ? (
            <button type="button" className="primaryButton" onClick={() => openApprovedJobDetail(project)}>
              Update Daily Job Cost
            </button>
          ) : null}
          {canSubmitInvoiceHandoff ? (
            <button type="button" className="primaryButton" onClick={() => openInvoiceHandoff(project)}>
              Complete Job &amp; Send to Invoicing
            </button>
          ) : null}
        </div>

        <div className="activeJobHeaderCards">
          <div className="summaryCard">
            <span>Status</span>
            <strong>{project.status || "Active"}</strong>
            <p>{project.currentPhase || "Current phase not set"}</p>
          </div>
          <div className="summaryCard">
            <span>Risk level</span>
            <strong>{project.riskLevel || "Normal"}</strong>
            <p>{project.riskReason || "No active risk notes."}</p>
          </div>
          {!isProjectManager ? (
            <div className="summaryCard">
              <span>Contract value</span>
              <strong>{money2(project.contractAmount || 0)}</strong>
              <p>Approved job value being tracked.</p>
            </div>
          ) : null}
          <div className="summaryCard">
            <span>Open issues</span>
            <strong>{num(openIssues, 0)}</strong>
            <p>{project.issues?.length ? "Issues are being monitored." : "No open issues yet."}</p>
          </div>
          <div className="summaryCard">
            <span>Start / end</span>
            <strong>{project.startDate || "TBD"}</strong>
            <p>{project.expectedCompletionDate || "Completion date TBD"}</p>
          </div>
        </div>

        <Section
          title="Project overview"
          subtitle={activeJobEditMode ? "Update the project information, team assignments, schedule, and financial progress." : "Review the active job details. Use Edit project details to make changes."}
          right={canManageActiveJobData && !activeJobEditMode ? (
            <button type="button" className="primaryButton" onClick={() => handleStartActiveJobEdit(project)}>
              Edit project details
            </button>
          ) : null}
        >
          {activeJobEditMode && activeJobEditDraft ? (
            <div className="activeJobEditForm">
              <div className="formGrid">
                <Field label="Project name">
                  <input type="text" value={activeJobEditDraft.projectName} disabled={isProjectManager} onChange={(e) => handleActiveJobEditFieldChange("projectName", e.target.value)} />
                </Field>
                <Field label="Job number">
                  <input type="text" value={activeJobEditDraft.jobNumber} disabled={isProjectManager} onChange={(e) => handleActiveJobEditFieldChange("jobNumber", e.target.value)} />
                </Field>
                <Field label="Project address">
                  <input type="text" value={activeJobEditDraft.address} disabled={isProjectManager} onChange={(e) => handleActiveJobEditFieldChange("address", e.target.value)} />
                </Field>
                <Field label="Customer / company">
                  <input type="text" value={activeJobEditDraft.customer} disabled={isProjectManager} onChange={(e) => handleActiveJobEditFieldChange("customer", e.target.value)} />
                </Field>
                <Field label="Homeowner / property owner">
                  <input type="text" value={activeJobEditDraft.propertyOwner} disabled={isProjectManager} onChange={(e) => handleActiveJobEditFieldChange("propertyOwner", e.target.value)} />
                </Field>
                <Field label="Property manager">
                  <input type="text" value={activeJobEditDraft.propertyManager} onChange={(e) => handleActiveJobEditFieldChange("propertyManager", e.target.value)} />
                </Field>
                <Field label="Project contact">
                  <input type="text" value={activeJobEditDraft.projectContact} onChange={(e) => handleActiveJobEditFieldChange("projectContact", e.target.value)} />
                </Field>
                <Field label="Project manager">
                  <input type="text" value={activeJobEditDraft.projectManager} onChange={(e) => handleActiveJobEditFieldChange("projectManager", e.target.value)} />
                </Field>
                <Field label="Field supervisor / superintendent">
                  <input type="text" value={activeJobEditDraft.fieldSupervisor} onChange={(e) => handleActiveJobEditFieldChange("fieldSupervisor", e.target.value)} />
                </Field>
                <Field label="Foreman">
                  <input type="text" value={activeJobEditDraft.foreman} onChange={(e) => handleActiveJobEditFieldChange("foreman", e.target.value)} />
                </Field>
                <Field label="Salesperson">
                  <input type="text" value={activeJobEditDraft.salesperson} disabled={isProjectManager} onChange={(e) => handleActiveJobEditFieldChange("salesperson", e.target.value)} />
                </Field>
                <Field label="Office coordinator">
                  <input type="text" value={activeJobEditDraft.officeCoordinator} onChange={(e) => handleActiveJobEditFieldChange("officeCoordinator", e.target.value)} />
                </Field>
                <Field label="Status">
                  <select value={activeJobEditDraft.status} onChange={(e) => handleActiveJobEditFieldChange("status", e.target.value)}>
                    {!ACTIVE_JOB_STATUS_OPTIONS.includes(activeJobEditDraft.status) ? <option value={activeJobEditDraft.status}>{activeJobEditDraft.status}</option> : null}
                    {ACTIVE_JOB_STATUS_OPTIONS.filter((status) => !["Completed", "Closed"].includes(status)).map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </Field>
                <Field label="Current phase">
                  <input type="text" value={activeJobEditDraft.currentPhase} onChange={(e) => handleActiveJobEditFieldChange("currentPhase", e.target.value)} />
                </Field>
                <Field label="Risk level">
                  <select value={activeJobEditDraft.riskLevel} onChange={(e) => handleActiveJobEditFieldChange("riskLevel", e.target.value)}>
                    {ACTIVE_JOB_RISK_LEVELS.map((riskLevel) => <option key={riskLevel} value={riskLevel}>{riskLevel}</option>)}
                  </select>
                </Field>
                <Field label="Risk notes">
                  <input type="text" value={activeJobEditDraft.riskReason} onChange={(e) => handleActiveJobEditFieldChange("riskReason", e.target.value)} />
                </Field>
                <Field label="Start date">
                  <input type="date" value={activeJobEditDraft.startDate} onChange={(e) => handleActiveJobEditFieldChange("startDate", e.target.value)} />
                </Field>
                <Field label="Expected completion date">
                  <input type="date" value={activeJobEditDraft.expectedCompletionDate} onChange={(e) => handleActiveJobEditFieldChange("expectedCompletionDate", e.target.value)} />
                </Field>
                <Field label="Percent complete">
                  <input type="number" onWheel={handleNumberInputWheel} min="0" max="100" step="1" value={activeJobEditDraft.percentComplete} onChange={(e) => handleActiveJobEditFieldChange("percentComplete", toNumber(e.target.value))} />
                </Field>
                {!isProjectManager ? (
                  <>
                    <Field label="Contract value">
                      <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={activeJobEditDraft.contractAmount} onChange={(e) => handleActiveJobEditFieldChange("contractAmount", toNumber(e.target.value))} />
                    </Field>
                    <Field label="Amount billed">
                      <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={activeJobEditDraft.amountBilled} onChange={(e) => handleActiveJobEditFieldChange("amountBilled", toNumber(e.target.value))} />
                    </Field>
                    <Field label="Amount collected">
                      <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={activeJobEditDraft.amountCollected} onChange={(e) => handleActiveJobEditFieldChange("amountCollected", toNumber(e.target.value))} />
                    </Field>
                  </>
                ) : null}
              </div>
              {!isProjectManager ? (
                <div className="summaryCard activeJobEditRemaining">
                  <span>Remaining contract value</span>
                  <strong>{money2(Math.max(0, toNumber(activeJobEditDraft.contractAmount) - toNumber(activeJobEditDraft.amountBilled)))}</strong>
                  <p>Calculated from contract value minus amount billed.</p>
                </div>
              ) : null}
              <div className="actionRow">
                <button type="button" className="primaryButton" disabled={Boolean(activeJobMutationKey)} onClick={() => void handleSaveActiveJobEdit(project)}>{activeJobMutationKey === `edit:${project.id}` ? "Saving changes…" : "Save project changes"}</button>
                <button type="button" className="secondaryButton" disabled={Boolean(activeJobMutationKey)} onClick={handleCancelActiveJobEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="detailList">
              <DetailRow label="Project address" value={project.projectAddress || project.jobAddress || project.address || "—"} />
              <DetailRow label="Customer" value={project.customerName || project.customer || "—"} />
              <DetailRow label="Property owner" value={project.propertyOwner || "—"} />
              <DetailRow label="Property manager" value={project.propertyManager || "—"} />
              <DetailRow label="Project contact" value={project.projectContact || "—"} />
              <DetailRow label="Project manager" value={project.projectManager || "—"} />
              <DetailRow label="Field supervisor / superintendent" value={project.fieldSupervisor || "—"} />
              <DetailRow label="Foreman" value={project.foreman || "—"} />
              <DetailRow label="Salesperson" value={project.salesperson || "—"} />
              <DetailRow label="Office coordinator" value={project.officeCoordinator || "—"} />
              <DetailRow label="Percent complete" value={`${num(project.percentComplete || 0, 0)}%`} />
              {!isProjectManager ? (
                <>
                  <DetailRow label="Amount billed" value={money2(project.amountBilled || 0)} />
                  <DetailRow label="Amount collected" value={money2(project.amountCollected || 0)} />
                  <DetailRow label="Remaining contract value" value={money2(project.remainingContractValue ?? Math.max(0, toNumber(project.contractAmount) - toNumber(project.amountBilled)))} />
                </>
              ) : null}
            </div>
          )}
        </Section>

        <div className="fieldOpsReviewColumns">
          <Section title="Team & outside contacts" subtitle="Internal team and any outside stakeholders tied to the project.">
            <div className="fieldOpsReviewColumns">
              <div className="panel">
                <h3>Internal team</h3>
                <div className="reviewTable">
                  {(project.team || []).length ? (
                    project.team.map((person, index) => (
                      <div key={`${person.name || "team"}-${index}`} className="reviewTableRow">
                        <span>{person.role || "Role"}</span>
                        <span>{person.name || "—"}</span>
                        <span>{person.company || "—"}</span>
                        <span>{person.phone || "—"}</span>
                        <span>{person.email || "—"}</span>
                      </div>
                    ))
                  ) : (
                    <p className="emptyState">No internal team members listed.</p>
                  )}
                </div>
              </div>
              <div className="panel">
                <h3>Outside contacts</h3>
                <div className="reviewTable">
                  {(project.outsideContacts || []).length ? (
                    project.outsideContacts.map((person, index) => (
                      <div key={`${person.name || "contact"}-${index}`} className="reviewTableRow">
                        <span>{person.role || "Role"}</span>
                        <span>{person.name || "—"}</span>
                        <span>{person.company || "—"}</span>
                        <span>{person.phone || "—"}</span>
                        <span>{person.email || "—"}</span>
                      </div>
                    ))
                  ) : (
                    <p className="emptyState">No outside contacts listed.</p>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Operations" subtitle="Current project phase, permit status, and status notes.">
            <div className="detailList">
              <DetailRow label="Schedule" value={project.operations?.schedule || "—"} />
              <DetailRow label="Daily job logs" value={num(project.operations?.dailyJobLogs || 0, 0)} />
              <DetailRow label="Crew hours" value={num(project.operations?.crewHours || 0, 0)} />
              <DetailRow label="Photos" value={num(project.operations?.photos || 0, 0)} />
              <DetailRow label="Materials" value={project.operations?.materials || "—"} />
              <DetailRow label="Subcontractor coordination" value={project.operations?.subcontractorCoordination || "—"} />
              <DetailRow label="Permit status" value={project.operations?.permitStatus || "—"} />
              <DetailRow label="Inspections" value={project.operations?.inspections || "—"} />
              <DetailRow label="Punch list" value={project.operations?.punchList || "—"} />
              <DetailRow label="Change orders" value={project.operations?.changeOrders || "—"} />
            </div>
          </Section>
        </div>

        <Section title="Action items" subtitle="What still needs to happen on this job.">
          {(project.actionItems || []).length ? (
            <div className="savedList">
              {project.actionItems.map((item) => (
                <div className="savedCard" key={item.id}>
                  <div>
                    <strong>{item.title || "Action item"}</strong>
                    <p>
                      {item.dueDate ? `Due ${item.dueDate} | ` : ""}
                      {item.status || "Open"}
                      {item.assignedEmployeeName ? ` | ${item.assignedEmployeeName}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="emptyState">No action items listed for this project.</p>
          )}
        </Section>

        <Section title="Issues" subtitle="Reported issues and escalation history.">
          {(project.issues || []).length ? (
            <div className="activeJobsTableWrap">
              <table className="activeJobsTable">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Caller</th>
                    <th>Assigned</th>
                    <th>Deadline</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {project.issues.map((issue) => (
                    <tr key={issue.id}>
                      <td>{issue.issueNumber || "—"}</td>
                      <td>{issue.category || "—"}</td>
                      <td>{issue.priority || "—"}</td>
                      <td>{issue.status || "—"}</td>
                      <td>{issue.description || "—"}</td>
                      <td>{issue.callerName || "—"}</td>
                      <td>{issue.assignedEmployeeName || "—"}</td>
                      <td>{issue.followUpDeadline ? new Date(issue.followUpDeadline).toLocaleString() : "—"}{!["resolved","closed"].includes(String(issue.status).toLowerCase()) && new Date(issue.followUpDeadline) < new Date() ? <strong> Overdue</strong> : null}</td>
                      <td>{canManageActiveJobData ? <button type="button" className="secondaryButton" onClick={() => openActiveJobIssueModal(project, issue)}>Update / history</button> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cfoDetailEmpty">
              <strong>No issues have been reported on this job.</strong>
              <p style={{ margin: "8px 0 0", color: "#a7c7d6" }}>
                Use Report Issue to create the first escalation and start the issue trail.
              </p>
            </div>
          )}
        </Section>

        <Section title="Activity log" subtitle="Recorded project activity and issue changes.">
          {(project.activityLog || []).length ? (
            <div className="savedList">
              {project.activityLog.map((entry) => (
                <div className="savedCard" key={entry.id}>
                  <div>
                    <strong>{entry.summary || "Activity entry"}</strong>
                    <p>
                      {entry.changedBy || "—"} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="emptyState">No activity recorded yet.</p>
          )}
        </Section>

        <Section title="Notifications and escalation" subtitle="Issue follow-up, response deadlines, and recorded changes.">
          <div className="detailList">
            <DetailRow label="Office notification" value="Automatic on save" note="Issue changes notify Jorge, Natalia, and the owner's linked account. Email delivery is queued." />
            <DetailRow label="Escalation" value="Owner and deadline required" note="Critical and Emergency issues require a response within one hour. Open serious and overdue issues receive daily reminders." />
            <DetailRow label="Audit trail" value="Recorded for each issue change" note="Open an issue to review who changed it, when, and the before-and-after details. Resolution requires a note and explicit confirmation." />
          </div>
        </Section>

        <div className="actionRow" style={{ marginTop: 16 }}>
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("activeJobs")}>Back to active jobs</button>
          <button type="button" className="primaryButton" onClick={() => openActiveJobIssueModal(project)}>Report Issue</button>
        </div>

        {renderActiveJobIssueModal()}
        {renderInvoiceHandoffModal()}
      </div>
    );
  
}
