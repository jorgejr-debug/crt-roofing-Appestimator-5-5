export default function CrmWorkspace({ workspace }) {
 const { CRM_FOLLOWUP_STATUS_OPTIONS, CRM_FOLLOWUP_TYPE_OPTIONS, CRM_LEAD_SERVICE_OPTIONS, CRM_LEAD_SOURCE_OPTIONS, CRM_LEAD_STATUS_OPTIONS, CRM_PIPELINE_STATUS_OPTIONS, CRM_PROPERTY_TYPE_OPTIONS, CRM_TIMELINE_TYPE_OPTIONS, CRM_URGENCY_OPTIONS, CRM_VISIT_OUTCOME_OPTIONS, DetailRow, Field, LOGO_SRC, Section, addCrmContactToCustomer, addCrmJobToCustomer, addCrmPropertyToCustomer, addCrmTimelineEntry, authUser, calculateDanielaKpis, calculateIvanKpis, calculateLeadKpis, completedJobs, convertCrmLeadToCustomer, crmActiveStaffOptions, crmCustomerDeletingId, crmCustomerDisplayName, crmCustomerDraft, crmCustomerSaving, crmCustomerSearch, crmCustomers, crmDanielaProfileId, crmFollowupDeletingId, crmFollowupDraft, crmFollowupSaving, crmFollowupSearch, crmFollowups, crmInspectionSending, crmIvanProfileId, crmLeadAssigneeFilter, crmLeadDateFrom, crmLeadDateTo, crmLeadDeletingId, crmLeadDisplayName, crmLeadDocuments, crmLeadDraft, crmLeadSearch, crmLeadSortBy, crmLeadSortDirection, crmLeadSourceFilter, crmLeadStatusFilter, crmLeadSyncError, crmLeadSyncStatus, crmLeadWorkOrderFile, crmLeadWorkOrderUploading, crmLeads, crmPipelineView, crmProposalAuditEvents, crmProposalRequests, crmProposalVersions, crmRecordSyncError, crmSelectedCustomer, crmTab, crmWeeklyInspectionTarget, css, deleteCrmCustomer, deleteCrmFollowup, deleteCrmLead, editCrmCustomer, editCrmFollowup, editCrmLead, getAccountTitle, handleCrmLeadAction, handleNumberInputWheel, isFinanceUser, money2, num, openCrmLeadDocument, openDashboardLeadCapture, openProposalBuilder, proposals, removeCrmContact, removeCrmFile, removeCrmJob, removeCrmProperty, removeCrmTimelineEntry, renderMiguelKpiSection, saveCrmCustomerDraft, saveCrmFollowupDraft, saveCrmLeadDraft, saveCrmWeeklyInspectionTarget, saveQuickLeadAndAddNext, selectCrmLeadWorkOrder, sendCrmLeadForInspection, setActiveTemplate, setCrmCustomerSearch, setCrmFollowupSearch, setCrmLeadAssigneeFilter, setCrmLeadDateFrom, setCrmLeadDateTo, setCrmLeadSearch, setCrmLeadSortBy, setCrmLeadSortDirection, setCrmLeadSourceFilter, setCrmLeadStatusFilter, setCrmPipelineView, setCrmTab, setCrmWeeklyInspectionTarget, setSessionMessage, setSessionMessageType, startNewCrmCustomerDraft, startNewCrmFollowupDraft, startNewCrmLeadDraft, toNumber, updateCrmContactField, updateCrmCustomerDraftField, updateCrmFollowupDraftField, updateCrmJobField, updateCrmLeadDraftField, updateCrmPropertyField, updateCrmTimelineField } = workspace;

    const assignedStaffOptions = [
      { value: "", label: "Unassigned" },
      ...crmActiveStaffOptions,
    ];
    const filteredLeads = [...crmLeads]
      .filter((lead) => {
        const haystack = [
          crmLeadDisplayName(lead),
          lead.phone,
          lead.email,
          lead.propertyAddress,
          lead.city,
          lead.zipCode,
          lead.leadSource,
          lead.roofingServiceNeeded,
          lead.description,
          lead.companyName,
          lead.bestTimeToCall,
          lead.secondaryPhone,
          lead.propertyType,
          lead.roofType,
          lead.approximateRoofSize,
          lead.urgency,
          lead.referredBy,
          lead.internalNotes,
          lead.assignedStaffId ? assignedStaffOptions.find((staff) => staff.value === lead.assignedStaffId)?.label : "",
          lead.leadStatus,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const query = crmLeadSearch.trim().toLowerCase();
        if (query && !haystack.includes(query)) return false;
        if (crmLeadStatusFilter !== "all" && String(lead.leadStatus || "") !== crmLeadStatusFilter) return false;
        if (crmLeadSourceFilter !== "all" && String(lead.leadSource || "") !== crmLeadSourceFilter) return false;
        if (crmLeadAssigneeFilter !== "all" && String(lead.assignedStaffId || "") !== crmLeadAssigneeFilter) return false;
        if (crmLeadDateFrom && String(lead.createdAt || "").slice(0, 10) < crmLeadDateFrom) return false;
        if (crmLeadDateTo && String(lead.createdAt || "").slice(0, 10) > crmLeadDateTo) return false;
        return true;
      })
      .sort((a, b) => {
        const direction = String(crmLeadSortDirection || "desc").toLowerCase() === "asc" ? 1 : -1;
        const sortBy = String(crmLeadSortBy || "createdAt");
        let comparison;
        if (sortBy === "oldest") {
          comparison = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
        } else if (sortBy === "followUpDate") {
          comparison = String(a.nextFollowUpDate || "").localeCompare(String(b.nextFollowUpDate || ""));
        } else if (sortBy === "value") {
          comparison = toNumber(a.estimatedValue, 0) - toNumber(b.estimatedValue, 0);
        } else {
          comparison = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
        }
        return comparison * direction;
      });

    const filteredCustomers = [...crmCustomers]
      .filter((customer) => {
        const query = crmCustomerSearch.trim().toLowerCase();
        if (!query) return true;
        const haystack = [
          crmCustomerDisplayName(customer),
          customer.phone,
          customer.secondaryPhone,
          customer.email,
          customer.billingAddress,
          customer.city,
          customer.zipCode,
          customer.customerType,
          customer.propertyType,
          customer.companyName,
          customer.notes,
          ...(customer.properties || []).flatMap((property) => [property.propertyName, property.propertyAddress, property.city, property.roofType, property.notes]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));

    const filteredFollowups = [...crmFollowups]
      .filter((followup) => {
        const query = crmFollowupSearch.trim().toLowerCase();
        if (!query) return true;
        const relatedLead = crmLeads.find((lead) => lead.id === followup.relatedId);
        const relatedCustomer = crmCustomers.find((customer) => customer.id === followup.relatedId);
        const haystack = [
          followup.title,
          followup.followUpType,
          followup.status,
          followup.dueDate,
          followup.notes,
          relatedLead ? crmLeadDisplayName(relatedLead) : "",
          relatedCustomer ? crmCustomerDisplayName(relatedCustomer) : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => String(a.dueDate || a.createdAt || "").localeCompare(String(b.dueDate || b.createdAt || "")));

    const openFollowups = filteredFollowups.filter((followup) => String(followup.status || "").toLowerCase() !== "completed");
    const chrisKpis = calculateLeadKpis(crmLeads, {
      originatorEmail: "chris@crtroofing.com",
      weeklyInspectionTarget: crmWeeklyInspectionTarget,
    });
    const ivanKpis = calculateIvanKpis(crmLeads, crmProposalRequests, {
      ivanUserId: crmIvanProfileId,
      weeklyInspectionTarget: crmWeeklyInspectionTarget,
    });
    const danielaKpis = calculateDanielaKpis(crmProposalRequests, crmProposalVersions, crmProposalAuditEvents, {
      danielaUserId: crmDanielaProfileId,
      periodDays: 30,
    });
    const danielaOverdueRequests = crmProposalRequests.filter((request) => danielaKpis.overdueRequestIds.includes(request.id));
    const ivanStaleLeads = crmLeads.filter((lead) => ivanKpis.staleLeadIds.includes(lead.id));
    const chrisApprovedPipeline = crmLeads
      .filter((lead) => String(lead.originatorEmail || "").toLowerCase() === "chris@crtroofing.com" && lead.leadStatus === "Approved")
      .reduce((sum, lead) => sum + Math.max(0, toNumber(lead.estimatedValue, 0)), 0);
    const chrisClosedJobs = completedJobs.filter((job) => {
      const attributionEmail = String(job.leadOriginatorEmail || job.commissionRecipientEmail || "").toLowerCase();
      const attributionName = String(job.commissionRecipientName || job.leadOriginatorName || job.salesperson || "").toLowerCase();
      return attributionEmail === "chris@crtroofing.com" || attributionName.includes("chris");
    });
    const chrisFinalizedGrossProfit = chrisClosedJobs.reduce((sum, job) => sum + Math.max(0, toNumber(job.commissionableGrossProfit, 0)), 0);
    const chrisEarnedCommission = chrisClosedJobs.reduce((sum, job) => sum + Math.max(0, toNumber(job.salesCommission, 0)), 0);
    const leadStatusCounts = CRM_LEAD_STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = crmLeads.filter((lead) => String(lead.leadStatus || "") === status).length;
      return acc;
    }, {});
    const kanbanColumns = CRM_PIPELINE_STATUS_OPTIONS.map((status) => ({
      status,
      leads: filteredLeads.filter((lead) => String(lead.leadStatus || "New") === status),
    }));
    const selectedCustomerFinancialSummary = (crmSelectedCustomer?.jobs || []).reduce(
      (acc, job) => {
        const contract = Math.max(0, toNumber(job.contractAmount, 0));
        const billed = Math.max(0, toNumber(job.amountBilled, 0));
        const collected = Math.max(0, toNumber(job.amountCollected, 0));
        acc.contract += contract;
        acc.billed += billed;
        acc.collected += collected;
        acc.remaining += Math.max(0, contract - collected);
        return acc;
      },
      { contract: 0, billed: 0, collected: 0, remaining: 0 },
    );

    const renderLeadCard = (lead) => (
      <div className="crmKanbanCard" key={lead.id}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span className={`statusTag ${lead.leadStatus === "Approved" ? "statusTag-approved" : lead.leadStatus === "Lost" ? "statusTag-draft" : ""}`}>{lead.leadStatus || "New"}</span>
          {lead.estimatedValue ? <span className="statusTag">${money2(toNumber(lead.estimatedValue, 0))}</span> : null}
        </div>
        <strong>{crmLeadDisplayName(lead)}</strong>
        <p>{lead.propertyAddress || "No property address"}</p>
        <p>{lead.roofingServiceNeeded || "No service selected"}</p>
        <p>{lead.phone || "No phone"}</p>
        <div className="savedActions">
          <button type="button" className="secondaryButton" onClick={() => editCrmLead(lead)}>
            Edit
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              setCrmTab("customers");
              if (lead.convertedCustomerId) {
                const customer = crmCustomers.find((item) => item.id === lead.convertedCustomerId);
                if (customer) editCrmCustomer(customer);
              }
            }}
          >
            Open file
          </button>
        </div>
      </div>
    );

    const renderCustomerFile = () => {
      if (!crmCustomerDraft.customerName && !crmCustomerDraft.companyName && !crmCustomerDraft.firstName && !crmCustomerDraft.lastName) {
        return <p className="emptyState">Select a customer to open the file, or create a new one above.</p>;
      }

      const propertyRows = Array.isArray(crmCustomerDraft.properties) ? crmCustomerDraft.properties : [];
      const contactRows = Array.isArray(crmCustomerDraft.contacts) ? crmCustomerDraft.contacts : [];
      const jobRows = Array.isArray(crmCustomerDraft.jobs) ? crmCustomerDraft.jobs : [];
      const timelineRows = Array.isArray(crmCustomerDraft.timeline) ? crmCustomerDraft.timeline : [];
      const fileRows = Array.isArray(crmCustomerDraft.files) ? crmCustomerDraft.files : [];
      const proposalArchiveRows = Array.isArray(crmCustomerDraft.proposalArchive) ? crmCustomerDraft.proposalArchive : [];
      const openProposalArchiveEntry = (archiveEntry) => {
        if (!archiveEntry) return;
        const matchingProposal =
          proposals.find(
            (proposal) =>
              proposal.id === archiveEntry.proposalId ||
              proposal.sourceEstimateCode === archiveEntry.sourceEstimateCode ||
              proposal.estimateCode === archiveEntry.estimateCode,
          ) || null;

        if (matchingProposal) {
          openProposalBuilder(matchingProposal);
          setSessionMessageType("success");
          setSessionMessage(`Opened proposal ${matchingProposal.proposalNumber || archiveEntry.proposalNumber || "record"}.`);
          return;
        }

        if (archiveEntry.pdfArchiveDataUrl) {
          const previewWindow = window.open(archiveEntry.pdfArchiveDataUrl, "_blank", "noopener,noreferrer");
          if (!previewWindow) {
            setSessionMessageType("error");
            setSessionMessage("The browser blocked the archived PDF preview.");
            return;
          }
          setSessionMessageType("success");
          setSessionMessage(`Opened archived PDF for proposal ${archiveEntry.proposalNumber || "record"}.`);
          return;
        }

        setSessionMessageType("error");
        setSessionMessage("That archived proposal is not linked to a live proposal or PDF yet.");
      };
      const downloadProposalArchivePdf = (archiveEntry) => {
        if (!archiveEntry?.pdfArchiveDataUrl) {
          setSessionMessageType("error");
          setSessionMessage("No archived PDF is stored for this proposal yet.");
          return;
        }
        const link = document.createElement("a");
        link.href = archiveEntry.pdfArchiveDataUrl;
        link.download = archiveEntry.pdfArchiveName || `proposal-${archiveEntry.proposalNumber || archiveEntry.id || "archive"}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSessionMessageType("success");
        setSessionMessage(`Downloaded archived PDF for proposal ${archiveEntry.proposalNumber || "record"}.`);
      };

      return (
        <div className="crmCustomerSections">
          <Section title="A. Customer Information" subtitle="Basic account information for CRM and office follow-up.">
            <div className="formGrid">
              <Field label="Customer name">
                <input type="text" value={crmCustomerDraft.customerName} onChange={(e) => updateCrmCustomerDraftField("customerName", e.target.value)} placeholder="Customer or company name" />
              </Field>
              <Field label="First name">
                <input type="text" value={crmCustomerDraft.firstName} onChange={(e) => updateCrmCustomerDraftField("firstName", e.target.value)} />
              </Field>
              <Field label="Last name">
                <input type="text" value={crmCustomerDraft.lastName} onChange={(e) => updateCrmCustomerDraftField("lastName", e.target.value)} />
              </Field>
              <Field label="Company / HOA / property management">
                <input type="text" value={crmCustomerDraft.companyName} onChange={(e) => updateCrmCustomerDraftField("companyName", e.target.value)} />
              </Field>
              <Field label="Primary phone">
                <input type="text" value={crmCustomerDraft.phone} onChange={(e) => updateCrmCustomerDraftField("phone", e.target.value)} />
              </Field>
              <Field label="Secondary phone">
                <input type="text" value={crmCustomerDraft.secondaryPhone} onChange={(e) => updateCrmCustomerDraftField("secondaryPhone", e.target.value)} />
              </Field>
              <Field label="Email">
                <input type="email" value={crmCustomerDraft.email} onChange={(e) => updateCrmCustomerDraftField("email", e.target.value)} />
              </Field>
              <Field label="Billing address">
                <input type="text" value={crmCustomerDraft.billingAddress} onChange={(e) => updateCrmCustomerDraftField("billingAddress", e.target.value)} />
              </Field>
              <Field label="City">
                <input type="text" value={crmCustomerDraft.city} onChange={(e) => updateCrmCustomerDraftField("city", e.target.value)} />
              </Field>
              <Field label="ZIP code">
                <input type="text" value={crmCustomerDraft.zipCode} onChange={(e) => updateCrmCustomerDraftField("zipCode", e.target.value)} />
              </Field>
              <Field label="Customer type">
                <select value={crmCustomerDraft.customerType} onChange={(e) => updateCrmCustomerDraftField("customerType", e.target.value)}>
                  <option value="">Select type</option>
                  {["Residential", "Commercial", "HOA", "Property Manager", "General Contractor", "Other"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Property type">
                <select value={crmCustomerDraft.propertyType} onChange={(e) => updateCrmCustomerDraftField("propertyType", e.target.value)}>
                  <option value="">Select property type</option>
                  {CRM_PROPERTY_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assigned staff member">
                <select value={crmCustomerDraft.assignedStaffId} onChange={(e) => updateCrmCustomerDraftField("assignedStaffId", e.target.value)}>
                  {assignedStaffOptions.map((option) => (
                    <option key={option.value || "unassigned"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Next follow-up date">
                <input type="date" value={crmCustomerDraft.nextFollowUpDate} onChange={(e) => updateCrmCustomerDraftField("nextFollowUpDate", e.target.value)} />
              </Field>
            </div>
            <div className="detailList" style={{ marginTop: 14 }}>
              <DetailRow label="Customer file id" value={crmCustomerDraft.id || "New customer"} />
              <DetailRow label="Properties" value={num(propertyRows.length, 0)} />
              <DetailRow label="Contacts" value={num(contactRows.length, 0)} />
              <DetailRow label="Jobs" value={num(jobRows.length, 0)} />
            </div>
          </Section>

          <Section title="B. Properties" subtitle="Track multiple properties for the same customer.">
            <div className="actionRow" style={{ marginBottom: 12 }}>
              <button type="button" className="primaryButton" onClick={addCrmPropertyToCustomer}>
                + Add property
              </button>
            </div>
            {propertyRows.length ? (
              <div className="savedList">
                {propertyRows.map((property) => (
                  <div className="savedCard" key={property.id}>
                    <div className="formGrid">
                      <Field label="Property name">
                        <input type="text" value={property.propertyName} onChange={(e) => updateCrmPropertyField(property.id, "propertyName", e.target.value)} />
                      </Field>
                      <Field label="Address">
                        <input type="text" value={property.propertyAddress} onChange={(e) => updateCrmPropertyField(property.id, "propertyAddress", e.target.value)} />
                      </Field>
                      <Field label="City">
                        <input type="text" value={property.city} onChange={(e) => updateCrmPropertyField(property.id, "city", e.target.value)} />
                      </Field>
                      <Field label="ZIP code">
                        <input type="text" value={property.zipCode} onChange={(e) => updateCrmPropertyField(property.id, "zipCode", e.target.value)} />
                      </Field>
                      <Field label="Property type">
                        <select value={property.propertyType} onChange={(e) => updateCrmPropertyField(property.id, "propertyType", e.target.value)}>
                          <option value="">Select type</option>
                          {CRM_PROPERTY_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Roof type">
                        <input type="text" value={property.roofType} onChange={(e) => updateCrmPropertyField(property.id, "roofType", e.target.value)} />
                      </Field>
                      <Field label="Approximate roof size">
                        <input type="text" value={property.approximateRoofSize} onChange={(e) => updateCrmPropertyField(property.id, "approximateRoofSize", e.target.value)} />
                      </Field>
                      <Field label="Notes">
                        <textarea rows="3" value={property.notes} onChange={(e) => updateCrmPropertyField(property.id, "notes", e.target.value)} />
                      </Field>
                    </div>
                    <div className="actionRow">
                      <button type="button" className="dangerButton" onClick={() => removeCrmProperty(property.id)}>
                        Remove property
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="emptyState">No properties have been added yet.</p>
            )}
          </Section>

          <Section title="C. Complete History Timeline" subtitle="Basic activity timeline for this customer.">
            <div className="actionRow" style={{ marginBottom: 12 }}>
              <button type="button" className="primaryButton" onClick={addCrmTimelineEntry}>
                + Add timeline entry
              </button>
            </div>
            {timelineRows.length ? (
              <div className="crmTimelineList">
                {timelineRows.map((entry) => (
                  <div className="crmTimelineItem" key={entry.id}>
                    <div className="formGrid">
                      <Field label="Activity type">
                        <select value={entry.label} onChange={(e) => updateCrmTimelineField(entry.id, "label", e.target.value)}>
                          {CRM_TIMELINE_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Created by">
                        <input type="text" value={entry.createdBy} onChange={(e) => updateCrmTimelineField(entry.id, "createdBy", e.target.value)} />
                      </Field>
                      <Field label="Summary">
                        <input type="text" value={entry.summary} onChange={(e) => updateCrmTimelineField(entry.id, "summary", e.target.value)} />
                      </Field>
                      <Field label="Date / time">
                        <input type="datetime-local" value={entry.createdAt ? String(entry.createdAt).slice(0, 16) : ""} onChange={(e) => updateCrmTimelineField(entry.id, "createdAt", e.target.value ? `${e.target.value}:00.000Z` : "")} />
                      </Field>
                      <Field label="Details">
                        <textarea rows="3" value={entry.details} onChange={(e) => updateCrmTimelineField(entry.id, "details", e.target.value)} />
                      </Field>
                    </div>
                    <div className="actionRow">
                      <button type="button" className="dangerButton" onClick={() => removeCrmTimelineEntry(entry.id)}>
                        Remove entry
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="emptyState">No timeline events yet.</p>
            )}
          </Section>

          <Section title="D. Files and Documents" subtitle="Use a protected shared workflow so the team receives the actual document.">
            <div className="statusMessage warningMessage" role="note" style={{ marginBottom: 12 }}>
              Customer-record file storage is not connected. Upload work orders in Quick Lead Capture and inspection or proposal documents in Proposal Requests. Those files are stored securely and shared with the assigned team.
            </div>
            <div className="actionRow" style={{ marginBottom: 12 }}>
              <button type="button" className="secondaryButton" onClick={openDashboardLeadCapture}>
                Open Quick Lead Capture
              </button>
              <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("proposalRequests")}>
                Open Proposal Requests
              </button>
            </div>
            {fileRows.length ? (
              <div className="savedList" aria-label="Legacy browser-only file references">
                <p className="smallNote">Legacy references below contain filenames only; the original files were not uploaded or shared.</p>
                {fileRows.map((file) => (
                  <div className="savedCard crmFileRow" key={file.id}>
                    <div>
                      <strong>{file.fileName || "Untitled file"}</strong>
                      <p>
                        {file.category || "Other"} | Uploaded {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : "local draft"}
                      </p>
                    </div>
                    <div className="savedActions">
                      <button type="button" className="dangerButton" onClick={() => removeCrmFile(file.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="emptyState">No legacy filename references.</p>
            )}
          </Section>

          <Section title="E. Jobs" subtitle="Track roof jobs associated with this customer.">
            <div className="actionRow" style={{ marginBottom: 12 }}>
              <button type="button" className="primaryButton" onClick={addCrmJobToCustomer}>
                + Add job
              </button>
            </div>
            {jobRows.length ? (
              <div className="savedList">
                {jobRows.map((job) => (
                  <div className="savedCard" key={job.id}>
                    <div className="formGrid">
                      <Field label="Job number">
                        <input type="text" value={job.jobNumber} onChange={(e) => updateCrmJobField(job.id, "jobNumber", e.target.value)} />
                      </Field>
                      <Field label="Project name">
                        <input type="text" value={job.projectName} onChange={(e) => updateCrmJobField(job.id, "projectName", e.target.value)} />
                      </Field>
                      <Field label="Status">
                        <select value={job.status} onChange={(e) => updateCrmJobField(job.id, "status", e.target.value)}>
                          {["Approved", "Scheduled", "Active", "On hold", "Completed", "Closed"].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Contract amount">
                        <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={job.contractAmount} onChange={(e) => updateCrmJobField(job.id, "contractAmount", e.target.value)} />
                      </Field>
                      <Field label="Amount billed">
                        <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={job.amountBilled} onChange={(e) => updateCrmJobField(job.id, "amountBilled", e.target.value)} />
                      </Field>
                      <Field label="Amount collected">
                        <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={job.amountCollected} onChange={(e) => updateCrmJobField(job.id, "amountCollected", e.target.value)} />
                      </Field>
                      <Field label="Start date">
                        <input type="date" value={job.startDate} onChange={(e) => updateCrmJobField(job.id, "startDate", e.target.value)} />
                      </Field>
                      <Field label="Completion date">
                        <input type="date" value={job.completionDate} onChange={(e) => updateCrmJobField(job.id, "completionDate", e.target.value)} />
                      </Field>
                      <Field label="Notes">
                        <textarea rows="3" value={job.notes} onChange={(e) => updateCrmJobField(job.id, "notes", e.target.value)} />
                      </Field>
                    </div>
                    <div className="actionRow">
                      <button type="button" className="dangerButton" onClick={() => removeCrmJob(job.id)}>
                        Remove job
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="emptyState">No jobs linked to this customer yet.</p>
            )}
            <div className="detailList" style={{ marginTop: 14 }}>
              <DetailRow label="Total contract value" value={money2(selectedCustomerFinancialSummary.contract)} />
              <DetailRow label="Total billed" value={money2(selectedCustomerFinancialSummary.billed)} />
              <DetailRow label="Total collected" value={money2(selectedCustomerFinancialSummary.collected)} />
              <DetailRow label="Remaining contract value" value={money2(selectedCustomerFinancialSummary.remaining)} />
            </div>
          </Section>

          <Section title="F. Financial Summary" subtitle="Basic account snapshot from linked jobs.">
            <div className="detailList">
              <DetailRow label="Jobs linked" value={num(jobRows.length, 0)} />
              <DetailRow label="Open balance" value={money2(Math.max(0, selectedCustomerFinancialSummary.remaining))} />
              <DetailRow label="Last updated" value={crmCustomerDraft.updatedAt ? new Date(crmCustomerDraft.updatedAt).toLocaleString() : "—"} />
            </div>
          </Section>

          <Section title="G. Proposal Archive" subtitle="Stored proposal versions, archive PDFs, and signature status for this customer.">
            <div className="detailList" style={{ marginBottom: 14 }}>
              <DetailRow label="Archived proposals" value={num(proposalArchiveRows.length, 0)} />
              <DetailRow label="Finalized proposals" value={num(proposalArchiveRows.filter((entry) => entry.isFinalized).length, 0)} />
              <DetailRow label="Signed proposals" value={num(proposalArchiveRows.filter((entry) => String(entry.signatureStatus || "").toLowerCase() === "signed").length, 0)} />
            </div>

            {proposalArchiveRows.length ? (
              <div className="savedList">
                {proposalArchiveRows.map((entry) => (
                  <div className="savedCard" key={entry.id}>
                    <div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                        <span className="eyebrow">Proposal #{num(entry.proposalNumber || 0, 0)}</span>
                        <span className={`statusTag statusTag-${String(entry.status || "draft").toLowerCase().replace(/\s+/g, "-")}`}>
                          {String(entry.status || "Draft").toUpperCase()}
                        </span>
                      </div>
                      <strong>{entry.proposalTitle || entry.projectName || entry.customerName || "Archived proposal"}</strong>
                      <p>
                        {entry.projectAddress ? `${entry.projectAddress} | ` : ""}
                        Version {num(entry.version || 1, 0)} | {entry.acceptanceStatus || "Pending"} | {entry.signatureStatus || "Unsigned"}
                      </p>
                      <p style={{ marginTop: 8 }}>
                        {entry.sentAt ? `Sent ${new Date(entry.sentAt).toLocaleString()} | ` : ""}
                        {entry.viewedAt ? `Viewed ${new Date(entry.viewedAt).toLocaleString()} | ` : "Viewed date not recorded | "}
                        {entry.finalizedAt ? `Finalized ${new Date(entry.finalizedAt).toLocaleString()}` : "Not finalized"}
                      </p>
                      <p style={{ marginTop: 8, color: "var(--text-muted)" }}>
                        Linked estimate: {entry.sourceEstimateCode || entry.estimateCode || "—"}
                      </p>
                    </div>
                    <div className="savedActions">
                      <button type="button" className="secondaryButton" onClick={() => openProposalArchiveEntry(entry)}>
                        Open
                      </button>
                      <button type="button" className="secondaryButton" onClick={() => downloadProposalArchivePdf(entry)}>
                        Download PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="emptyState">No proposal versions have been archived for this customer yet.</p>
            )}
          </Section>

          <Section title="H. Contacts" subtitle="Store primary and secondary contacts for the customer.">
            <div className="actionRow" style={{ marginBottom: 12 }}>
              <button type="button" className="primaryButton" onClick={addCrmContactToCustomer}>
                + Add contact
              </button>
            </div>
            {contactRows.length ? (
              <div className="savedList">
                {contactRows.map((contact) => (
                  <div className="savedCard" key={contact.id}>
                    <div className="formGrid">
                      <Field label="Name">
                        <input type="text" value={contact.name} onChange={(e) => updateCrmContactField(contact.id, "name", e.target.value)} />
                      </Field>
                      <Field label="Role">
                        <input type="text" value={contact.role} onChange={(e) => updateCrmContactField(contact.id, "role", e.target.value)} />
                      </Field>
                      <Field label="Phone">
                        <input type="text" value={contact.phone} onChange={(e) => updateCrmContactField(contact.id, "phone", e.target.value)} />
                      </Field>
                      <Field label="Email">
                        <input type="email" value={contact.email} onChange={(e) => updateCrmContactField(contact.id, "email", e.target.value)} />
                      </Field>
                      <Field label="Primary contact?">
                        <select value={contact.isPrimary ? "yes" : "no"} onChange={(e) => updateCrmContactField(contact.id, "isPrimary", e.target.value === "yes")}>
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </Field>
                      <Field label="Notes">
                        <textarea rows="3" value={contact.notes} onChange={(e) => updateCrmContactField(contact.id, "notes", e.target.value)} />
                      </Field>
                    </div>
                    <div className="actionRow">
                      <button type="button" className="dangerButton" onClick={() => removeCrmContact(contact.id)}>
                        Remove contact
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="emptyState">No contacts saved yet.</p>
            )}
          </Section>

          <Section title="I. Notes" subtitle="General notes for office and sales follow-up.">
            <Field label="Notes">
              <textarea rows="6" value={crmCustomerDraft.notes} onChange={(e) => updateCrmCustomerDraftField("notes", e.target.value)} />
            </Field>
          </Section>
        </div>
      );
    };

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
                <p className="eyebrow">CRT Roofing CRM</p>
                <h1>CRM / Leads</h1>
                <p className="intro">Capture shared leads and move qualified opportunities into CRT Roofing's operating workflow.</p>
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
          <button type="button" className="secondaryButton" onClick={() => startNewCrmLeadDraft()}>
            + New lead
          </button>
          <button type="button" className="secondaryButton" onClick={startNewCrmCustomerDraft}>
            + Shared customer
          </button>
          <button type="button" className="secondaryButton" onClick={startNewCrmFollowupDraft}>
            + Shared reminder
          </button>
        </div>

        <Section title="CRM Tabs" subtitle="Phase 1 workflow pages.">
          <div className="dashboardTabBar">
            {[
              ["quickCapture", "Quick Capture"],
              ["newLead", "Qualify / Edit"],
              ["pipeline", "Lead Pipeline"],
              ["customers", "Customers"],
              ["followUps", "Reminders"],
              ["reports", "KPI Scorecards"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`dashboardTabButton ${crmTab === key ? "active" : ""}`}
                onClick={() => setCrmTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="smallNote" style={{ margin: 0 }}>
            Shared CRM: {crmLeadSyncStatus === "saving" ? "saving..." : crmLeadSyncStatus === "saved" ? "synced" : crmLeadSyncStatus === "loading" ? "loading..." : "local fallback"}
            {crmLeadSyncError ? ` · ${crmLeadSyncError}` : ""}{crmRecordSyncError ? ` · ${crmRecordSyncError}` : ""}
          </p>
        </Section>

        {crmTab === "quickCapture" ? (
          <Section title="Quick Lead Capture" subtitle="Built for the road: capture the opportunity now and qualify it later.">
            <div className="quickLeadCaptureGrid">
              <Field label="Contact or company *">
                <input autoFocus type="text" value={crmLeadDraft.contactName} onChange={(e) => updateCrmLeadDraftField("contactName", e.target.value)} placeholder="Person or business name" />
              </Field>
              <Field label="Phone">
                <input type="tel" inputMode="tel" value={crmLeadDraft.phone} onChange={(e) => updateCrmLeadDraftField("phone", e.target.value)} placeholder="Best callback number" />
              </Field>
              <Field label="Property address">
                <input type="text" value={crmLeadDraft.propertyAddress} onChange={(e) => updateCrmLeadDraftField("propertyAddress", e.target.value)} placeholder="Address if available" />
              </Field>
              <Field label="Opportunity type">
                <select value={crmLeadDraft.roofingServiceNeeded} onChange={(e) => updateCrmLeadDraftField("roofingServiceNeeded", e.target.value)}>
                  <option value="">Not sure yet</option>
                  {CRM_LEAD_SERVICE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Visit outcome">
                <select value={crmLeadDraft.visitOutcome} onChange={(e) => updateCrmLeadDraftField("visitOutcome", e.target.value)}>
                  {CRM_VISIT_OUTCOME_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="One quick note">
                <textarea rows="3" value={crmLeadDraft.description} onChange={(e) => updateCrmLeadDraftField("description", e.target.value)} placeholder="What did they need or say?" />
              </Field>
              <Field label="PDF work order (optional)">
                <input type="file" accept=".pdf,application/pdf" onChange={(e) => selectCrmLeadWorkOrder(e.target.files?.[0] || null)} />
                <span className="smallNote">{crmLeadWorkOrderFile ? `${crmLeadWorkOrderFile.name} ready to upload` : "Attach the customer's PDF work order if one was provided. Maximum 25 MB."}</span>
              </Field>
            </div>
            <div className="detailList" style={{ marginTop: 14 }}>
              <DetailRow label="Originator" value={crmLeadDraft.originatorName || authUser?.displayName || "Current user"} />
              <DetailRow label="Source" value={crmLeadDraft.leadSource || "Cold Calling"} />
              <DetailRow label="Starting status" value="New · Needs qualification" />
            </div>
            <div className="actionRow" style={{ marginTop: 16 }}>
              <button type="button" className="primaryButton" disabled={crmInspectionSending || crmLeadWorkOrderUploading || crmLeadSyncStatus === "saving"} onClick={saveQuickLeadAndAddNext}>
                {crmLeadWorkOrderUploading
                  ? "Uploading work order…"
                  : crmLeadSyncStatus === "saving"
                    ? "Saving…"
                    : crmLeadDraft.visitOutcome === "inspection"
                      ? (crmInspectionSending ? "Sending to Ivan…" : "Save & Send to Ivan")
                      : "Save & Add Next"}
              </button>
              <button
                type="button"
                className="secondaryButton"
                disabled={crmInspectionSending || crmLeadWorkOrderUploading || crmLeadSyncStatus === "saving"}
                onClick={() => sendCrmLeadForInspection(crmLeadDraft, true)}
              >
                {crmInspectionSending ? "Sending to Ivan…" : "Send for Inspection"}
              </button>
              <button type="button" className="secondaryButton" disabled={crmLeadSyncStatus === "saving"} onClick={() => setCrmTab("newLead")}>Continue to Qualification</button>
              <button type="button" className="dangerButton" disabled={crmLeadSyncStatus === "saving"} onClick={() => startNewCrmLeadDraft()}>Clear</button>
            </div>
            <p className="smallNote" style={{ margin: "10px 0 0" }}>
              Use Send for Inspection only when the caller needs a roof inspection. Ivan will receive an in-app task and an email that a customer is waiting to be scheduled.
            </p>
          </Section>
        ) : null}

        {crmTab === "newLead" ? (
          <Section
            title="Qualify / Edit Lead"
            subtitle="Office follow-up and qualification live here so quick field capture stays fast."
            right={
              <div className="actionRow" style={{ margin: 0 }}>
                <button type="button" className="secondaryButton" onClick={() => editCrmLead(crmLeadDraft)}>
                  Edit current lead
                </button>
              </div>
            }
          >
            <div className="detailList" style={{ marginBottom: 14 }}>
              <DetailRow label="Total leads" value={num(crmLeads.length, 0)} />
              <DetailRow label="Open follow-ups" value={num(openFollowups.length, 0)} />
              <DetailRow label="Customers" value={num(crmCustomers.length, 0)} />
            </div>

            <div className="formGrid">
              <Field label="Quick-capture contact / company">
                <input type="text" value={crmLeadDraft.contactName} onChange={(e) => updateCrmLeadDraftField("contactName", e.target.value)} />
              </Field>
              <Field label="Qualification status">
                <select value={crmLeadDraft.qualificationStatus} onChange={(e) => updateCrmLeadDraftField("qualificationStatus", e.target.value)}>
                  <option value="captured">Needs qualification</option>
                  <option value="qualified">Qualified</option>
                  <option value="not_qualified">Not qualified</option>
                </select>
              </Field>
              <Field label="First name *">
                <input type="text" value={crmLeadDraft.firstName} onChange={(e) => updateCrmLeadDraftField("firstName", e.target.value)} />
              </Field>
              <Field label="Last name *">
                <input type="text" value={crmLeadDraft.lastName} onChange={(e) => updateCrmLeadDraftField("lastName", e.target.value)} />
              </Field>
              <Field label="Phone number *">
                <input type="text" value={crmLeadDraft.phone} onChange={(e) => updateCrmLeadDraftField("phone", e.target.value)} />
              </Field>
              <Field label="Email *">
                <input type="email" value={crmLeadDraft.email} onChange={(e) => updateCrmLeadDraftField("email", e.target.value)} />
              </Field>
              <Field label="Property address *">
                <input type="text" value={crmLeadDraft.propertyAddress} onChange={(e) => updateCrmLeadDraftField("propertyAddress", e.target.value)} />
              </Field>
              <Field label="City *">
                <input type="text" value={crmLeadDraft.city} onChange={(e) => updateCrmLeadDraftField("city", e.target.value)} />
              </Field>
              <Field label="ZIP code *">
                <input type="text" value={crmLeadDraft.zipCode} onChange={(e) => updateCrmLeadDraftField("zipCode", e.target.value)} />
              </Field>
              <Field label="Lead source *">
                <select value={crmLeadDraft.leadSource} onChange={(e) => updateCrmLeadDraftField("leadSource", e.target.value)}>
                  <option value="">Select source</option>
                  {CRM_LEAD_SOURCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Roofing service needed *">
                <select value={crmLeadDraft.roofingServiceNeeded} onChange={(e) => updateCrmLeadDraftField("roofingServiceNeeded", e.target.value)}>
                  <option value="">Select service</option>
                  {CRM_LEAD_SERVICE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lead status *">
                <select value={crmLeadDraft.leadStatus} onChange={(e) => updateCrmLeadDraftField("leadStatus", e.target.value)}>
                  {CRM_LEAD_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assigned staff member">
                <select value={crmLeadDraft.assignedStaffId} onChange={(e) => updateCrmLeadDraftField("assignedStaffId", e.target.value)}>
                  <option value="">Unassigned</option>
                  {crmActiveStaffOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Approximate roof size">
                <input type="text" value={crmLeadDraft.approximateRoofSize} onChange={(e) => updateCrmLeadDraftField("approximateRoofSize", e.target.value)} placeholder="SQ or square footage" />
              </Field>
              <Field label="Urgency">
                <select value={crmLeadDraft.urgency} onChange={(e) => updateCrmLeadDraftField("urgency", e.target.value)}>
                  {CRM_URGENCY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Company / HOA / property management">
                <input type="text" value={crmLeadDraft.companyName} onChange={(e) => updateCrmLeadDraftField("companyName", e.target.value)} />
              </Field>
              <Field label="Best time to call">
                <input type="text" value={crmLeadDraft.bestTimeToCall} onChange={(e) => updateCrmLeadDraftField("bestTimeToCall", e.target.value)} />
              </Field>
              <Field label="Secondary phone">
                <input type="text" value={crmLeadDraft.secondaryPhone} onChange={(e) => updateCrmLeadDraftField("secondaryPhone", e.target.value)} />
              </Field>
              <Field label="Property type">
                <select value={crmLeadDraft.propertyType} onChange={(e) => updateCrmLeadDraftField("propertyType", e.target.value)}>
                  <option value="">Select property type</option>
                  {CRM_PROPERTY_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Roof type">
                <input type="text" value={crmLeadDraft.roofType} onChange={(e) => updateCrmLeadDraftField("roofType", e.target.value)} />
              </Field>
              <Field label="Insurance claim?">
                <select value={crmLeadDraft.insuranceClaim ? "yes" : "no"} onChange={(e) => updateCrmLeadDraftField("insuranceClaim", e.target.value === "yes")}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>
              <Field label="Referred by">
                <input type="text" value={crmLeadDraft.referredBy} onChange={(e) => updateCrmLeadDraftField("referredBy", e.target.value)} />
              </Field>
              <Field label="Estimated value">
                <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={crmLeadDraft.estimatedValue} onChange={(e) => updateCrmLeadDraftField("estimatedValue", e.target.value)} />
              </Field>
              <Field label="Next follow-up date">
                <input type="date" value={crmLeadDraft.nextFollowUpDate} onChange={(e) => updateCrmLeadDraftField("nextFollowUpDate", e.target.value)} />
              </Field>
              <Field label="Appointment date">
                <input type="date" value={crmLeadDraft.appointmentDate} onChange={(e) => updateCrmLeadDraftField("appointmentDate", e.target.value)} />
              </Field>
              <Field label="Brief description of request *">
                <textarea rows="4" value={crmLeadDraft.description} onChange={(e) => updateCrmLeadDraftField("description", e.target.value)} />
              </Field>
              <Field label="Internal notes">
                <textarea rows="4" value={crmLeadDraft.internalNotes} onChange={(e) => updateCrmLeadDraftField("internalNotes", e.target.value)} />
              </Field>
            </div>

            <div className="detailList" style={{ marginTop: 14 }}>
              <DetailRow label="Lead originator" value={crmLeadDraft.originatorName || crmLeadDraft.originatorEmail || "—"} />
              <DetailRow label="Relationship owner" value={crmLeadDraft.relationshipOwnerId === crmLeadDraft.originatorId ? "Originator remains relationship owner" : crmLeadDraft.relationshipOwnerId || "—"} />
              <DetailRow label="Qualified" value={crmLeadDraft.qualifiedAt ? new Date(crmLeadDraft.qualifiedAt).toLocaleString() : "Not yet"} />
              <DetailRow label="Last activity" value={crmLeadDraft.lastActivityDate ? new Date(crmLeadDraft.lastActivityDate).toLocaleString() : "—"} />
              <DetailRow label="Converted customer" value={crmLeadDraft.convertedCustomerId || "—"} />
              <DetailRow label="Lead created" value={crmLeadDraft.createdAt ? new Date(crmLeadDraft.createdAt).toLocaleString() : "—"} />
            </div>
            <div className="summaryCard" style={{ marginTop: 14 }}>
              <strong>Lead documents</strong>
              <p className="smallNote">Private PDF work orders attached during Quick Capture.</p>
              <div className="actionRow">
                {crmLeadDocuments.filter((document) => document.lead_id === crmLeadDraft.id).map((document) => <button key={document.id} type="button" className="secondaryButton" onClick={() => void openCrmLeadDocument(document)}>Open PDF: {document.file_name}</button>)}
                {!crmLeadDocuments.some((document) => document.lead_id === crmLeadDraft.id) ? <span className="smallNote">No PDF work order attached.</span> : null}
              </div>
            </div>

            <div className="actionRow" style={{ marginTop: 16 }}>
              <button type="button" className="primaryButton" disabled={crmLeadSyncStatus === "saving"} onClick={() => void saveCrmLeadDraft("Lead saved to the shared CRM.")}>
                {crmLeadSyncStatus === "saving" ? "Saving…" : "Save Lead"}
              </button>
              <button
                type="button"
                className="secondaryButton"
                disabled={crmInspectionSending || crmLeadSyncStatus === "saving"}
                onClick={() => sendCrmLeadForInspection(crmLeadDraft)}
              >
                {crmInspectionSending ? "Sending to Ivan…" : "Send for Inspection"}
              </button>
              <button type="button" className="secondaryButton" disabled={crmLeadSyncStatus === "saving"} onClick={() => handleCrmLeadAction("scheduleAppointment")}>
                Schedule Appointment
              </button>
              <button type="button" className="secondaryButton" disabled={crmLeadSyncStatus === "saving"} onClick={() => handleCrmLeadAction("createEstimate")}>
                Create Estimate
              </button>
              <button type="button" className="secondaryButton" disabled={crmLeadSyncStatus === "saving"} onClick={convertCrmLeadToCustomer}>
                {crmLeadSyncStatus === "saving" ? "Saving…" : "Convert to Customer"}
              </button>
              <button type="button" className="dangerButton" disabled={crmLeadSyncStatus === "saving"} onClick={() => startNewCrmLeadDraft()}>
                Clear Lead
              </button>
            </div>
          </Section>
        ) : null}

        {crmTab === "pipeline" ? (
          <Section title="Lead Pipeline" subtitle="Switch between table and Kanban views for lead tracking.">
            <div className="detailList" style={{ marginBottom: 14 }}>
              <DetailRow label="Total leads" value={num(filteredLeads.length, 0)} />
              <DetailRow label="Appointment scheduled" value={num(leadStatusCounts["Appointment Scheduled"], 0)} />
              <DetailRow label="Approved" value={num(leadStatusCounts.Approved, 0)} />
              <DetailRow label="Follow-up tasks" value={num(openFollowups.length, 0)} />
            </div>

            <div className="formGrid">
              <Field label="Search leads">
                <input type="search" value={crmLeadSearch} onChange={(e) => setCrmLeadSearch(e.target.value)} placeholder="Search name, phone, address, source, or service" />
              </Field>
              <Field label="Status">
                <select value={crmLeadStatusFilter} onChange={(e) => setCrmLeadStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  {CRM_LEAD_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lead source">
                <select value={crmLeadSourceFilter} onChange={(e) => setCrmLeadSourceFilter(e.target.value)}>
                  <option value="all">All sources</option>
                  {CRM_LEAD_SOURCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assigned staff">
                <select value={crmLeadAssigneeFilter} onChange={(e) => setCrmLeadAssigneeFilter(e.target.value)}>
                  <option value="all">All staff</option>
                  {crmActiveStaffOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date range from">
                <input type="date" value={crmLeadDateFrom} onChange={(e) => setCrmLeadDateFrom(e.target.value)} />
              </Field>
              <Field label="Date range to">
                <input type="date" value={crmLeadDateTo} onChange={(e) => setCrmLeadDateTo(e.target.value)} />
              </Field>
              <Field label="Sort by">
                <select value={crmLeadSortBy} onChange={(e) => setCrmLeadSortBy(e.target.value)}>
                  <option value="createdAt">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="followUpDate">Follow-up date</option>
                  <option value="value">Value</option>
                </select>
              </Field>
              <Field label="Sort order">
                <select value={crmLeadSortDirection} onChange={(e) => setCrmLeadSortDirection(e.target.value)}>
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </Field>
            </div>

            <div className="dashboardTabBar" style={{ marginTop: 12 }}>
              <button type="button" className={`dashboardTabButton ${crmPipelineView === "table" ? "active" : ""}`} onClick={() => setCrmPipelineView("table")}>
                Table view
              </button>
              <button type="button" className={`dashboardTabButton ${crmPipelineView === "kanban" ? "active" : ""}`} onClick={() => setCrmPipelineView("kanban")}>
                Kanban view
              </button>
            </div>

            {crmPipelineView === "table" ? (
              <div className="tableWrap" style={{ marginTop: 14 }}>
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Lead name</th>
                      <th>Phone</th>
                      <th>Property address</th>
                      <th>Service needed</th>
                      <th>Lead source</th>
                      <th>Originator</th>
                      <th>Qualification</th>
                      <th>Assigned staff</th>
                      <th>Status</th>
                      <th>Next follow-up</th>
                      <th>Created date</th>
                      <th>Last activity</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.length ? (
                      filteredLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td>{crmLeadDisplayName(lead)}</td>
                          <td>{lead.phone || "—"}</td>
                          <td>{lead.propertyAddress || "—"}</td>
                          <td>{lead.roofingServiceNeeded || "—"}</td>
                          <td>{lead.leadSource || "—"}</td>
                          <td>{lead.originatorName || lead.originatorEmail || "—"}</td>
                          <td>{lead.qualificationStatus === "qualified" ? "Qualified" : lead.qualificationStatus === "not_qualified" ? "Not qualified" : "Needs qualification"}</td>
                          <td>{crmActiveStaffOptions.find((option) => option.value === lead.assignedStaffId)?.label || "Unassigned"}</td>
                          <td>{lead.leadStatus || "New"}</td>
                          <td>{lead.nextFollowUpDate || "—"}</td>
                          <td>{lead.createdAt ? lead.createdAt.slice(0, 10) : "—"}</td>
                          <td>{lead.lastActivityDate ? lead.lastActivityDate.slice(0, 10) : "—"}</td>
                          <td>
                            <div className="actionRow">
                              <button type="button" className="secondaryButton" onClick={() => editCrmLead(lead)}>
                                Edit
                              </button>
                              {isFinanceUser ? (
                                <button type="button" className="dangerButton" disabled={Boolean(crmLeadDeletingId)} onClick={() => void deleteCrmLead(lead.id)}>
                                  {crmLeadDeletingId === lead.id ? "Deleting…" : "Delete"}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="11">
                          <p className="emptyState">No leads match the current filters.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="crmKanban" style={{ marginTop: 14 }}>
                {kanbanColumns.map((column) => (
                  <div className="crmKanbanColumn" key={column.status}>
                    <h4>
                      {column.status} ({column.leads.length})
                    </h4>
                    {column.leads.length ? (
                      column.leads.map((lead) => renderLeadCard(lead))
                    ) : (
                      <p className="emptyState">No leads in this stage.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        ) : null}

        {crmTab === "customers" ? (
          <Section
            title="Shared Customers"
            subtitle="Customer details, properties, contacts, history, and notes are synchronized for the authorized CRM team."
            right={
              <div className="actionRow" style={{ margin: 0 }}>
                <button type="button" className="secondaryButton" onClick={startNewCrmCustomerDraft}>
                  New customer
                </button>
                <button type="button" className="secondaryButton" disabled={crmCustomerSaving} onClick={() => void saveCrmCustomerDraft()}>
                  {crmCustomerSaving ? "Saving…" : "Save customer"}
                </button>
              </div>
            }
          >
            <div className="detailList" style={{ marginBottom: 14 }}>
              <DetailRow label="Customer records" value={num(crmCustomers.length, 0)} />
              <DetailRow label="Selected customer" value={crmSelectedCustomer ? crmCustomerDisplayName(crmSelectedCustomer) : "None"} />
              <DetailRow label="Files attached" value={num((crmCustomerDraft.files || []).length, 0)} />
              <DetailRow label="Jobs linked" value={num((crmCustomerDraft.jobs || []).length, 0)} />
            </div>

            <div className="formGrid" style={{ marginBottom: 14 }}>
              <Field label="Search customers">
                <input type="search" value={crmCustomerSearch} onChange={(e) => setCrmCustomerSearch(e.target.value)} placeholder="Search customer, property, contact, or note" />
              </Field>
            </div>

            <div className="savedList" style={{ marginBottom: 18 }}>
              {filteredCustomers.length ? (
                filteredCustomers.map((customer) => (
                  <div className="savedCard" key={customer.id}>
                    <div>
                      <strong>{crmCustomerDisplayName(customer)}</strong>
                      <p>
                        {customer.phone || "No phone"} | {customer.email || "No email"} | {customer.billingAddress || "No billing address"}
                      </p>
                    </div>
                    <div className="savedActions">
                      <button type="button" className="secondaryButton" onClick={() => editCrmCustomer(customer)}>
                        Open file
                      </button>
                      {isFinanceUser ? <button type="button" className="dangerButton" disabled={crmCustomerDeletingId === customer.id} onClick={() => void deleteCrmCustomer(customer)}>
                        {crmCustomerDeletingId === customer.id ? "Deleting…" : "Delete"}
                      </button> : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="emptyState">No customers saved yet.</p>
              )}
            </div>

            {renderCustomerFile()}
          </Section>
        ) : null}

        {crmTab === "followUps" ? (
          <Section
            title="Shared Reminders"
            subtitle="CRM reminders synchronize across authorized employees; assign formal work in Tasks & Messages."
            right={
              <div className="actionRow" style={{ margin: 0 }}>
                <button type="button" className="secondaryButton" onClick={startNewCrmFollowupDraft}>
                  New follow-up
                </button>
                <button type="button" className="secondaryButton" disabled={crmFollowupSaving} onClick={() => void saveCrmFollowupDraft()}>
                  {crmFollowupSaving ? "Saving…" : "Save reminder"}
                </button>
              </div>
            }
          >
            <div className="statusMessage infoMessage" role="note" style={{ marginBottom: 14 }}>
              Reminders track CRM follow-up. For accountable assigned work and discussion, create a task in Tasks & Messages.
              <div className="actionRow" style={{ marginTop: 10 }}>
                <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("workHub")}>Open Tasks & Messages</button>
              </div>
            </div>
            <div className="formGrid">
              <Field label="Search follow-ups">
                <input type="search" value={crmFollowupSearch} onChange={(e) => setCrmFollowupSearch(e.target.value)} placeholder="Search tasks, due dates, or notes" />
              </Field>
              <Field label="Related type">
                <select value={crmFollowupDraft.relatedType} onChange={(e) => updateCrmFollowupDraftField("relatedType", e.target.value)}>
                  <option value="lead">Lead</option>
                  <option value="customer">Customer</option>
                </select>
              </Field>
              <Field label="Related record">
                <select value={crmFollowupDraft.relatedId} onChange={(e) => updateCrmFollowupDraftField("relatedId", e.target.value)}>
                  <option value="">Select record</option>
                  {(crmFollowupDraft.relatedType === "customer" ? crmCustomers : crmLeads).map((item) => (
                    <option key={item.id} value={item.id}>
                      {crmFollowupDraft.relatedType === "customer" ? crmCustomerDisplayName(item) : crmLeadDisplayName(item)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title *">
                <input type="text" value={crmFollowupDraft.title} onChange={(e) => updateCrmFollowupDraftField("title", e.target.value)} />
              </Field>
              <Field label="Due date *">
                <input type="date" value={crmFollowupDraft.dueDate} onChange={(e) => updateCrmFollowupDraftField("dueDate", e.target.value)} />
              </Field>
              <Field label="Follow-up type">
                <select value={crmFollowupDraft.followUpType} onChange={(e) => updateCrmFollowupDraftField("followUpType", e.target.value)}>
                  {CRM_FOLLOWUP_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assigned staff member">
                <select value={crmFollowupDraft.assignedStaffId} onChange={(e) => updateCrmFollowupDraftField("assignedStaffId", e.target.value)}>
                  <option value="">Unassigned</option>
                  {crmActiveStaffOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={crmFollowupDraft.status} onChange={(e) => updateCrmFollowupDraftField("status", e.target.value)}>
                  {CRM_FOLLOWUP_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Notes">
                <textarea rows="4" value={crmFollowupDraft.notes} onChange={(e) => updateCrmFollowupDraftField("notes", e.target.value)} />
              </Field>
            </div>

            <div className="detailList" style={{ marginTop: 14 }}>
              <DetailRow label="Open tasks" value={num(openFollowups.length, 0)} />
              <DetailRow label="Total tasks" value={num(filteredFollowups.length, 0)} />
              <DetailRow label="Selected task" value={crmFollowupDraft.title || "New follow-up"} />
            </div>

            <div className="savedList" style={{ marginTop: 14 }}>
              {filteredFollowups.length ? (
                filteredFollowups.map((followup) => (
                  <div className="savedCard" key={followup.id}>
                    <div>
                      <strong>{followup.title || "Untitled follow-up"}</strong>
                      <p>
                        {followup.followUpType || "Task"} | {followup.dueDate || "No due date"} | {followup.status || "Open"}
                      </p>
                    </div>
                    <div className="savedActions">
                      <button type="button" className="secondaryButton" onClick={() => editCrmFollowup(followup)}>
                        Edit
                      </button>
                      {(isFinanceUser || followup.createdBy === authUser?.key) ? <button type="button" className="dangerButton" disabled={crmFollowupDeletingId === followup.id} onClick={() => void deleteCrmFollowup(followup)}>
                        {crmFollowupDeletingId === followup.id ? "Deleting…" : "Delete"}
                      </button> : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="emptyState">No follow-up tasks yet.</p>
              )}
            </div>
          </Section>
        ) : null}

        {crmTab === "reports" ? (
          <>
          {isFinanceUser ? renderMiguelKpiSection() : null}

          {(isFinanceUser
            || String(authUser?.email || "").trim().toLowerCase() === "daniela@crtroofing.com"
            || String(authUser?.id || authUser?.key || "") === crmDanielaProfileId) ? (
          <Section title="Daniela · Proposal & Estimating KPI" subtitle="Thirty-day proposal funnel: review complete requests, prepare the Word and PDF package, and deliver it to Sales Review within the assigned SLA.">
            <div className="summaryGrid">
              <div className="summaryCard">
                <span>Overall KPI score</span>
                <strong>{danielaKpis.overallScore === null ? "—" : `${danielaKpis.overallScore}%`}</strong>
                <p>Weighted only from categories with enough current data.</p>
              </div>
              <div className="summaryCard">
                <span>Complete proposal handoff · primary KPI</span>
                <strong>{danielaKpis.turnaroundRate === null ? "—" : `${Math.round(danielaKpis.turnaroundRate * 100)}%`}</strong>
                <p>{`${String(danielaKpis.turnaroundStatus || "gray").toUpperCase()} · ${danielaKpis.turnaroundOnTime} of ${danielaKpis.turnaroundEligible} eligible requests reached Sales Review on time with Word and PDF. Target: 90%.`}</p>
              </div>
              <div className="summaryCard">
                <span>Requests submitted</span>
                <strong>{num(danielaKpis.submittedCount, 0)}</strong>
                <p>Complete requests assigned to Daniela in the last 30 days.</p>
              </div>
              <div className="summaryCard">
                <span>Requests reviewed</span>
                <strong>{num(danielaKpis.reviewedCount, 0)}</strong>
                <p>{danielaKpis.intakeResponseRate === null ? "No eligible intake response to score yet." : `${Math.round(danielaKpis.intakeResponseRate * 100)}% reviewed within 4 business hours. Target: 90%.`}</p>
              </div>
              <div className="summaryCard">
                <span>Proposals finalized</span>
                <strong>{num(danielaKpis.finalizedSubmittedCount, 0)}</strong>
                <p>Submitted requests with a finalized proposal version.</p>
              </div>
              <div className="summaryCard">
                <span>Proposals sent</span>
                <strong>{num(danielaKpis.sentCount, 0)}</strong>
                <p>Requests sent to the customer during the reporting period.</p>
              </div>
              <div className="summaryCard">
                <span>Average drafting time</span>
                <strong>{danielaKpis.averageTurnaroundHours === null ? "—" : `${danielaKpis.averageTurnaroundHours.toFixed(1)}h`}</strong>
                <p>Business hours from submission to finalized proposal, excluding recorded SLA pauses.</p>
              </div>
              <div className="summaryCard">
                <span>Complete Word + PDF handoff</span>
                <strong>{danielaKpis.documentCompletenessRate === null ? "—" : `${Math.round(danielaKpis.documentCompletenessRate * 100)}%`}</strong>
                <p>{`${danielaKpis.completeHandoffs} of ${danielaKpis.finalizedCount} finalized versions included both required files. Target: 100%.`}</p>
              </div>
              <div className="summaryCard">
                <span>Active estimating queue</span>
                <strong>{num(danielaKpis.activeQueueCount, 0)}</strong>
                <p>{`${danielaKpis.overdueCount} overdue active request${danielaKpis.overdueCount === 1 ? "" : "s"}.`}</p>
              </div>
              <div className="summaryCard">
                <span>Awaiting Sales Review</span>
                <strong>{num(danielaKpis.awaitingSalesReviewCount, 0)}</strong>
                <p>Drafting is complete and responsibility is currently with the salesperson.</p>
              </div>
              <div className="summaryCard">
                <span>Returned for missing info</span>
                <strong>{num(danielaKpis.missingInformationCount, 0)}</strong>
                <p>Workload and intake-quality context only; this does not lower Daniela's score.</p>
              </div>
            </div>
            <div className="notice" style={{ marginTop: 16 }}>
              <strong>Thirty-day proposal funnel</strong>
              <p style={{ marginBottom: 0 }}>{`${num(danielaKpis.submittedCount, 0)} submitted → ${num(danielaKpis.reviewedCount, 0)} reviewed → ${num(danielaKpis.finalizedSubmittedCount, 0)} finalized → ${num(danielaKpis.sentCount, 0)} sent. Missing-information pauses and work waiting on Sales Review are visible context and do not lower Daniela's score.`}</p>
            </div>
            {danielaOverdueRequests.length ? (
              <div className="savedList" style={{ marginTop: 16 }}>
                {danielaOverdueRequests.map((request) => (
                  <div className="savedCard" key={request.id}>
                    <div>
                      <span className="eyebrow">Overdue estimating request</span>
                      <strong>{request.property_name || request.customer_name || `Proposal Request ${request.request_number || ""}`}</strong>
                      <p>{request.target_completion_at ? `Target ${new Date(request.target_completion_at).toLocaleString()}` : "No target recorded"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="smallNote" style={{ marginTop: 16 }}>No active estimating requests are overdue.</p>
            )}
            <div className="notice" style={{ marginTop: 16 }}>
              <strong>Scoring weights</strong>
              <p style={{ marginBottom: 0 }}>On-time proposal handoff 45% · intake response 20% · Word/PDF completeness 20% · active-queue hygiene 15%. Customer waiting time and Sales Review waiting time are excluded from Daniela's score.</p>
            </div>
          </Section>
          ) : null}

          {(isFinanceUser || String(authUser?.email || "").trim().toLowerCase() === "ivan@crtroofing.com") ? (
          <Section title="Ivan · Estimator / Technician KPI" subtitle="Weekly inspection funnel: respond to assigned customers, complete roof inspections, and submit complete proposal requests to Daniela.">
            <div className="summaryGrid">
              <div className="summaryCard">
                <span>Overall KPI score</span>
                <strong>{ivanKpis.overallScore === null ? "—" : `${ivanKpis.overallScore}%`}</strong>
                <p>Weighted only from KPI categories with enough current data.</p>
              </div>
              <div className="summaryCard">
                <span>On-time proposal handoff · primary KPI</span>
                <strong>{ivanKpis.handoffRate === null ? "—" : `${Math.round(ivanKpis.handoffRate * 100)}%`}</strong>
                <p>{`${String(ivanKpis.handoffStatus || "gray").toUpperCase()} · ${ivanKpis.handoffOnTime} of ${ivanKpis.handoffEligible} eligible inspections submitted within 1 business day. Target: 90%.`}</p>
              </div>
              <div className="summaryCard">
                <span>Assigned inspections</span>
                <strong>{`${num(ivanKpis.assignedThisWeek, 0)} / ${num(ivanKpis.weeklyCapacity, 0)}`}</strong>
                <p>{ivanKpis.capacityCoverage === null ? "Set capacity below." : `${Math.round(ivanKpis.capacityCoverage * 100)}% of weekly capacity supplied.`}</p>
              </div>
              <div className="summaryCard">
                <span>Available inspection capacity</span>
                <strong>{num(ivanKpis.availableCapacity, 0)}</strong>
                <p>Remaining management-set inspection slots this week.</p>
              </div>
              <div className="summaryCard">
                <span>Inspections completed</span>
                <strong>{num(ivanKpis.completedThisWeek, 0)}</strong>
                <p>{ivanKpis.executionRate === null ? "No assigned inspections to score yet." : `${Math.round(ivanKpis.executionRate * 100)}% execution against supplied work.`}</p>
              </div>
              <div className="summaryCard">
                <span>Customer contact SLA</span>
                <strong>{ivanKpis.contactSlaRate === null ? "—" : `${Math.round(ivanKpis.contactSlaRate * 100)}%`}</strong>
                <p>{`${ivanKpis.contactOnTime} of ${ivanKpis.contactEligible} eligible requests contacted within 2 business hours. Target: 90%.`}</p>
              </div>
              <div className="summaryCard">
                <span>Proposal requests submitted</span>
                <strong>{num(ivanKpis.submittedAfterInspection, 0)}</strong>
                <p>Completed inspections connected to a submitted proposal request this week.</p>
              </div>
              <div className="summaryCard">
                <span>First-pass completeness</span>
                <strong>{ivanKpis.firstPassRate === null ? "—" : `${Math.round(ivanKpis.firstPassRate * 100)}%`}</strong>
                <p>{`${ivanKpis.acceptedFirstPass} of ${ivanKpis.firstPassEligible} reviewed requests were not returned for missing information. Target: 90%.`}</p>
              </div>
              <div className="summaryCard">
                <span>Stale inspection work</span>
                <strong>{num(ivanKpis.staleCount, 0)}</strong>
                <p>Inspection-stage leads without an update for more than 2 business days.</p>
              </div>
            </div>
            <div className="notice" style={{ marginTop: 16 }}>
              <strong>Weekly inspection funnel</strong>
              <p style={{ marginBottom: 0 }}>{`${num(ivanKpis.assignedThisWeek, 0)} assigned inspections → ${num(ivanKpis.completedThisWeek, 0)} completed inspections → ${num(ivanKpis.submittedAfterInspection, 0)} proposal requests submitted. Lead supply is displayed as capacity context and does not penalize Ivan.`}</p>
            </div>
            {isFinanceUser ? (
              <div className="formGrid" style={{ marginTop: 16 }}>
                <Field label="Ivan's weekly inspection capacity">
                  <input type="number" min="1" step="1" value={crmWeeklyInspectionTarget} onChange={(e) => setCrmWeeklyInspectionTarget(e.target.value)} />
                </Field>
                <div className="actionRow" style={{ alignItems: "end" }}>
                  <button type="button" className="primaryButton" onClick={saveCrmWeeklyInspectionTarget}>Save KPI Target</button>
                </div>
              </div>
            ) : null}
            {ivanStaleLeads.length ? (
              <div className="savedList" style={{ marginTop: 16 }}>
                {ivanStaleLeads.map((lead) => (
                  <div className="savedCard" key={lead.id}>
                    <div>
                      <span className="eyebrow">Needs update</span>
                      <strong>{crmLeadDisplayName(lead)}</strong>
                      <p>{lead.propertyAddress || lead.phone || "No contact details recorded"}</p>
                    </div>
                    <button type="button" className="secondaryButton" onClick={() => editCrmLead(lead)}>Open Lead</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="smallNote" style={{ marginTop: 16 }}>No stale inspection work currently needs attention.</p>
            )}
            <div className="notice" style={{ marginTop: 16 }}>
              <strong>Scoring weights</strong>
              <p style={{ marginBottom: 0 }}>On-time proposal handoff 40% · inspection execution 25% · first-pass completeness 20% · customer contact 10% · open-work hygiene 5%. Categories without enough data are excluded rather than counted against Ivan.</p>
            </div>
          </Section>
          ) : null}

          <Section title="Chris · Business Development KPI" subtitle="Weekly field funnel: visit new customers, create qualified roofing opportunities, and keep Ivan supplied with inspections.">
            <div className="summaryGrid">
              <div className="summaryCard">
                <span>Weekly KPI score</span>
                <strong>{`${num(chrisKpis.weeklyScore, 0)}%`}</strong>
                <p>Qualified leads 60% · customer visits 20% · inspection handoffs 20%.</p>
              </div>
              <div className="summaryCard">
                <span>Qualified leads · primary KPI</span>
                <strong>{`${num(chrisKpis.qualifiedThisWeek, 0)} / ${num(chrisKpis.weeklyQualifiedTarget, 6)}`}</strong>
                <p>{`${String(chrisKpis.qualifiedStatus || "red").toUpperCase()} · legitimate opportunities created from this week's visits.`}</p>
              </div>
              <div className="summaryCard">
                <span>New customer visits</span>
                <strong>{`${num(chrisKpis.customerVisitsThisWeek, 0)} / ${num(chrisKpis.weeklyVisitTarget, 36)}`}</strong>
                <p>Cold-call customer visits logged this week.</p>
              </div>
              <div className="summaryCard">
                <span>Visit conversion</span>
                <strong>{`${Math.round(chrisKpis.qualificationRate * 100)}%`}</strong>
                <p>Qualified leads divided by logged customer visits. Target: 15% or better.</p>
              </div>
              <div className="summaryCard">
                <span>Inspection handoffs</span>
                <strong>{`${num(chrisKpis.inspectionReadyThisWeek, 0)} / ${num(chrisKpis.weeklyChrisInspectionTarget, 4)}`}</strong>
                <p>{`${Math.round(chrisKpis.inspectionConversionRate * 100)}% of qualified leads sent into the inspection workflow.`}</p>
              </div>
              <div className="summaryCard">
                <span>Ivan's available capacity</span>
                <strong>{num(Math.max(0, crmWeeklyInspectionTarget - ivanKpis.assignedThisWeek), 0)}</strong>
                <p>{`${num(ivanKpis.assignedThisWeek, 0)} of ${num(crmWeeklyInspectionTarget, 0)} inspection slots supplied this week.`}</p>
              </div>
              <div className="summaryCard">
                <span>Stale open leads</span>
                <strong>{num(chrisKpis.staleCount, 0)}</strong>
                <p>No recorded activity for more than seven days.</p>
              </div>
              <div className="summaryCard">
                <span>SOP compliance</span>
                <strong>{`${Math.round(chrisKpis.processComplianceRate * 100)}%`}</strong>
                <p>Proposal-stage leads have a completed qualification record.</p>
              </div>
              <div className="summaryCard">
                <span>Approved pipeline value</span>
                <strong>{money2(chrisApprovedPipeline)}</strong>
                <p>Estimated value only; not gross profit or earned commission.</p>
              </div>
              <div className="summaryCard">
                <span>Closed attributed jobs</span>
                <strong>{num(chrisClosedJobs.length, 0)}</strong>
                <p>Completed jobs traced back to Chris or assigned to his commission record.</p>
              </div>
              <div className="summaryCard">
                <span>Finalized gross profit</span>
                <strong>{money2(chrisFinalizedGrossProfit)}</strong>
                <p>After direct job costs, other costs, and operating/overhead.</p>
              </div>
              <div className="summaryCard">
                <span>Earned commission</span>
                <strong>{money2(chrisEarnedCommission)}</strong>
                <p>25% of finalized commissionable gross profit on Chris-originated jobs.</p>
              </div>
            </div>
            <div className="notice" style={{ marginTop: 16 }}>
              <strong>Weekly funnel</strong>
              <p style={{ marginBottom: 0 }}>{`${num(chrisKpis.customerVisitsThisWeek, 0)} customer visits → ${num(chrisKpis.qualifiedThisWeek, 0)} qualified leads → ${num(chrisKpis.inspectionReadyThisWeek, 0)} inspection handoffs. Green begins at 6 qualified leads, yellow at 4, and red below 4.`}</p>
            </div>
            <div className="notice" style={{ marginTop: 16 }}>
              <strong>Commission control</strong>
              <p style={{ marginBottom: 0 }}>Chris's 25% commission must be calculated from finalized job gross profit after operating/overhead costs. The CRM stores permanent lead attribution now; the dollar commission should populate only after that lead is linked through proposal, signed job, production, and closeout.</p>
            </div>
          </Section>
          </>
        ) : null}
      </div>
    );
  
}
