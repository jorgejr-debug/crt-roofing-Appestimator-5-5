export default function ApprovedJobWorkspace({ workspace }) {
 const { APPROVED_JOB_OPERATING_OVERHEAD_RATE, Field, LOGO_SRC, PAYROLL_TAX_RATE, SPRAY_FOAM_GALLONS_PER_KIT, SPRAY_FOAM_KIT_COST, Section, TRAVEL_VEHICLE_OPTIONS, approvedAttachmentUploadingDayIds, approvedDailyProgressLogs, approvedJobData, authUser, buildEmployeeDisplayName, calculateApprovedJobFullyLoadedProfitability, calculateApprovedJobTotals, calculateDailyEmployeeLaborCost, calculateDailyTravelCost, calculateSubcontractorCost, canManageSharedJobData, collapsedApprovedDailyProgressDayIds, css, employeeDirectory, formatAttachmentSize, handleAddDailyProgressDay, handleAddDailyTravelRow, handleAddEmployeeRow, handleAddMaterialItem, handleAddSubcontractorRow, handleApprovedJobFormChange, handleApprovedJobSalespersonChange, handleApprovedProgressAttachmentUpload, handleDailyProgressFieldChange, handleDailyTravelRowChange, handleDeleteDailyProgressDay, handleDeleteEmployeeRow, handleEmployeeRowChange, handleMaterialItemChange, handleNumberInputWheel, handleOpenApprovedProgressAttachment, handleRemoveApprovedProgressAttachment, handleRemoveDailyTravelRow, handleRemoveMaterialItem, handleRemoveSubcontractorRow, handleSaveApprovedJob, handleSubcontractorRowChange, handleToggleDailyProgressDay, isProjectManager, money2, round, selectedApprovedJob, sessionMessage, sessionMessageType, setActiveTemplate, summarizeApprovedDailyProgress, toNumber } = workspace;

    if (!approvedJobData) {
      return (
        <div className="appShell">
          <style>{css}</style>
          <div className="actionRow" style={{ marginBottom: 16 }}>
            <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("approvedJobs")}>Back to approved jobs</button>
          </div>
          <Section title="Approved job" subtitle="Select a job to view or edit daily progress.">
            <p className="intro">No job selected.</p>
          </Section>
        </div>
      );
    }

    const totals = calculateApprovedJobTotals(approvedDailyProgressLogs);
    const financialSummary = calculateApprovedJobFullyLoadedProfitability({
      approvedSalePrice: approvedJobData.approvedBidAmount,
      changeOrders: approvedJobData.changeOrders,
      directJobCost: totals.directActualCost,
      operatingOverheadCost: totals.operatingOverheadCost,
      otherJobCosts: approvedJobData.otherJobCosts,
      salesCommissionRate: approvedJobData.salesCommissionRate,
    });
    const dailyCostReturnTemplate = selectedApprovedJob?.workflowStatus === "active" ? "activeJob" : "approvedJobs";
    const payrollTaxPercentLabel = `${(PAYROLL_TAX_RATE * 100).toFixed(2)}%`;

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
                <p className="eyebrow">CRT Roofing Employee Portal</p>
                <h1>Approved Job: {approvedJobData.estimateCode}</h1>
                <p className="intro">Track daily progress and job status without modifying the original estimate.</p>
              </div>
            </div>
          </div>

          <div className="heroCard">
            <span>Signed in</span>
            <strong>{authUser.displayName}</strong>
          </div>
        </header>

        <div className="actionRow" style={{ marginBottom: 16 }}>
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate(dailyCostReturnTemplate)}>
            {dailyCostReturnTemplate === "activeJob" ? "Back to active job" : "Back to approved jobs"}
          </button>
        </div>

        {sessionMessage && (
          <div style={{ margin: "0 0 16px 0", padding: 12, borderRadius: 4, backgroundColor: sessionMessageType === "success" ? "#e8f5e9" : "#ffebee", color: sessionMessageType === "success" ? "#2e7d32" : "#c62828" }}>
            {sessionMessage}
          </div>
        )}

        <Section title="Job details" subtitle="Review the approved job summary.">
          <div className="formGrid">
            <Field label="Job name">
              <input type="text" value={approvedJobData.jobName} disabled />
            </Field>
            <Field label="Customer name">
              <input type="text" value={approvedJobData.customerName} disabled />
            </Field>
            <Field label="Estimate code">
              <input type="text" value={approvedJobData.estimateCode} disabled />
            </Field>
            <Field label="Roof type">
              <input type="text" value={approvedJobData.roofType} disabled />
            </Field>
            <Field label="Total squares">
              <input type="number" onWheel={handleNumberInputWheel} value={approvedJobData.totalSquares} disabled />
            </Field>
            {!isProjectManager ? (
              <>
                <Field label="Approved bid amount">
                  <input type="number" onWheel={handleNumberInputWheel} value={approvedJobData.approvedBidAmount} disabled={!canManageSharedJobData} onChange={(e) => handleApprovedJobFormChange("approvedBidAmount", toNumber(e.target.value))} />
                </Field>
                <Field label="Change orders total (if any)">
                  <input type="number" onWheel={handleNumberInputWheel} step="0.01" value={approvedJobData.changeOrders ?? 0} disabled={!canManageSharedJobData} onChange={(e) => handleApprovedJobFormChange("changeOrders", toNumber(e.target.value))} />
                </Field>
                <Field label="Salesperson">
                  <input type="text" value={approvedJobData.salesperson || ""} disabled={!canManageSharedJobData} onChange={(e) => handleApprovedJobSalespersonChange(e.target.value)} />
                </Field>
                <Field label="Sales commission rate (%)">
                  <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={round(toNumber(approvedJobData.salesCommissionRate) * 100, 2)} disabled={!canManageSharedJobData} onChange={(e) => handleApprovedJobFormChange("salesCommissionRate", Math.max(0, toNumber(e.target.value)) / 100)} />
                </Field>
                <Field label="Other job costs">
                  <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={approvedJobData.otherJobCosts ?? 0} disabled={!canManageSharedJobData} onChange={(e) => handleApprovedJobFormChange("otherJobCosts", Math.max(0, toNumber(e.target.value)))} />
                </Field>
              </>
            ) : null}
            <Field label="Job status">
              <select value={approvedJobData.status} disabled={!canManageSharedJobData} onChange={(e) => handleApprovedJobFormChange("status", e.target.value)}>
                <option value="approved">Approved</option>
                <option value="scheduled">Scheduled</option>
                <option value="in progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Daily job progress" subtitle="Log each day with labor, materials, notes, and issues.">
          <div className="actionRow" style={{ marginBottom: 12 }}>
            <button type="button" className="secondaryButton" onClick={handleAddDailyProgressDay}>
              Add day
            </button>
          </div>

          {approvedDailyProgressLogs.length ? (
            approvedDailyProgressLogs.map((day, dayIndex) => {
              const isCollapsed = collapsedApprovedDailyProgressDayIds.includes(day.id);
              const daySummary = summarizeApprovedDailyProgress(day);
              return (
              <div key={day.id} className="panel approvedDailyProgressCard" style={{ marginBottom: 12 }}>
                <div className="approvedDailyProgressHeader">
                  <div>
                    <p className="approvedDailyProgressEyebrow">Day {dayIndex + 1}</p>
                    <h3>{day.date || "Date not selected"}</h3>
                    <p className="approvedDailyProgressSummary">
                      {isProjectManager
                        ? `Crew ${toNumber(day.crewSize)} · ${round(daySummary.laborHours, 2)} labor hours · ${round(daySummary.travelMiles, 2)} travel miles`
                        : `Crew ${toNumber(day.crewSize)} · ${round(daySummary.laborHours, 2)} labor hours · ${money2(daySummary.laborCost)} loaded labor · ${money2(daySummary.subcontractorCost)} subcontractors · ${money2(daySummary.materialCost)} materials · ${money2(daySummary.travelCost)} travel/fuel`}
                    </p>
                  </div>
                  <div className="approvedDailyProgressActions">
                    <button
                      type="button"
                      className="secondaryButton"
                      aria-expanded={!isCollapsed}
                      aria-controls={`approved-daily-progress-${day.id}`}
                      onClick={() => handleToggleDailyProgressDay(day.id)}
                    >
                      {isCollapsed ? "Expand" : "Minimize"}
                    </button>
                    {canManageSharedJobData ? (
                      <button type="button" className="dangerButton" onClick={() => handleDeleteDailyProgressDay(day.id)}>
                        Delete day
                      </button>
                    ) : null}
                  </div>
                </div>

                {!isCollapsed ? (
                <div id={`approved-daily-progress-${day.id}`} className="approvedDailyProgressBody">
                <div className="formGrid">
                  <Field label="Date">
                    <input type="date" value={day.date} onChange={(e) => handleDailyProgressFieldChange(day.id, "date", e.target.value)} />
                  </Field>
                  <Field label="Crew size">
                    <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={day.crewSize} onChange={(e) => handleDailyProgressFieldChange(day.id, "crewSize", toNumber(e.target.value))} />
                  </Field>
                </div>

                <div className="formGrid" style={{ marginTop: 12 }}>
                  <Field label="Employee labor">
                    <div>
                      {(day.employeeRows || []).map((employee) => {
                        const laborCost = calculateDailyEmployeeLaborCost(employee);
                        return (
                          <div key={employee.id} style={{ marginBottom: 12, border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
                            <div className="formGrid">
                              <Field label="CRT employee">
                                <select value={employee.employeeId || ""} onChange={(e) => handleEmployeeRowChange(day.id, employee.id, "employeeId", e.target.value)}>
                                  <option value="">Select employee</option>
                                  {employeeDirectory.filter((person) => person.isActive).map((person) => (
                                    <option key={person.id} value={person.id}>
                                      {buildEmployeeDisplayName(person) || "Unnamed employee"}{isProjectManager ? "" : ` · ${money2(person.hourlyRate || 0)}/hr`}
                                    </option>
                                  ))}
                                </select>
                                {!employee.employeeId && employee.employeeName ? <p className="smallNote">Previously saved: {employee.employeeName}</p> : null}
                              </Field>
                              <Field label="Hours">
                                <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.5" value={employee.hoursWorked} onChange={(e) => handleEmployeeRowChange(day.id, employee.id, "hoursWorked", toNumber(e.target.value))} />
                              </Field>
                              {!isProjectManager ? (
                                <>
                                  <Field label="Base hourly wage">
                                    <input type="number" value={laborCost.hourlyRate} disabled />
                                  </Field>
                                  <Field label="Base payroll">
                                    <input type="text" value={money2(laborCost.basePayroll)} disabled />
                                  </Field>
                                  <Field label="Workers’ comp (50%)">
                                    <input type="text" value={money2(laborCost.workersCompCost)} disabled />
                                  </Field>
                                  <Field label={`Payroll tax (${payrollTaxPercentLabel})`}>
                                    <input type="text" value={money2(laborCost.payrollTaxCost)} disabled />
                                  </Field>
                                </>
                              ) : null}
                              {!isProjectManager ? (
                                <Field label="Total loaded labor cost">
                                  <input type="text" value={money2(laborCost.totalLaborCost)} disabled />
                                </Field>
                              ) : null}
                            </div>
                            <div className="actionRow" style={{ marginTop: 12 }}>
                              <button type="button" className="secondaryButton" onClick={() => handleDeleteEmployeeRow(day.id, employee.id)}>
                                Delete employee row
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button type="button" className="secondaryButton" onClick={() => handleAddEmployeeRow(day.id)}>
                        Add employee row
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="formGrid" style={{ marginTop: 12 }}>
                  <Field label="Sub-contractors">
                    <div>
                      {(day.subcontractors || []).map((subcontractor) => {
                        const subcontractorCost = calculateSubcontractorCost(subcontractor);
                        return (
                          <div key={subcontractor.id} style={{ marginBottom: 12, border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
                            <div className="formGrid">
                              <Field label="Company">
                                <input
                                  type="text"
                                  value={subcontractor.company || ""}
                                  onChange={(e) => handleSubcontractorRowChange(day.id, subcontractor.id, "company", e.target.value)}
                                />
                              </Field>
                              <Field label="Squares">
                                <input
                                  type="number"
                                  onWheel={handleNumberInputWheel}
                                  min="0"
                                  step="0.1"
                                  value={subcontractor.squares ?? 0}
                                  onChange={(e) => handleSubcontractorRowChange(day.id, subcontractor.id, "squares", toNumber(e.target.value))}
                                />
                              </Field>
                              <Field label="Price per square">
                                <input
                                  type="number"
                                  onWheel={handleNumberInputWheel}
                                  min="0"
                                  step="0.01"
                                  value={subcontractor.pricePerSquare ?? 0}
                                  onChange={(e) => handleSubcontractorRowChange(day.id, subcontractor.id, "pricePerSquare", toNumber(e.target.value))}
                                />
                              </Field>
                              <Field label="Total cost">
                                <input type="text" value={money2(subcontractorCost.totalCost)} disabled />
                              </Field>
                            </div>
                            <div className="actionRow" style={{ marginTop: 12 }}>
                              <button type="button" className="secondaryButton" onClick={() => handleRemoveSubcontractorRow(day.id, subcontractor.id)}>
                                Delete subcontractor
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button type="button" className="secondaryButton" onClick={() => handleAddSubcontractorRow(day.id)}>
                        Add subcontractor
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="formGrid" style={{ marginTop: 12 }}>
                  <Field label="Materials used">
                    <div>
                      <div style={{ marginBottom: 12, border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
                        <div className="formGrid">
                          <Field label="Spray Foam Gallons used">
                            <input
                              type="number"
                              onWheel={handleNumberInputWheel}
                              min="0"
                              step="0.1"
                              value={day.sprayFoamGallonsUsed ?? 0}
                              onChange={(e) => handleDailyProgressFieldChange(day.id, "sprayFoamGallonsUsed", toNumber(e.target.value))}
                            />
                          </Field>
                          <Field label={`Equivalent kits (${SPRAY_FOAM_GALLONS_PER_KIT} gal/kit)`}>
                            <input type="number" value={round(daySummary.sprayFoamEquivalentKits, 3)} disabled />
                          </Field>
                          <Field label="Foam kit cost">
                            <input type="text" value={money2(SPRAY_FOAM_KIT_COST)} disabled />
                          </Field>
                          <Field label="Total spray foam cost">
                            <input type="text" value={money2(daySummary.sprayFoamCost)} disabled />
                          </Field>
                        </div>
                        <p className="smallNote" style={{ marginTop: 8 }}>
                          Gallons used ÷ {SPRAY_FOAM_GALLONS_PER_KIT} gallons per kit × {money2(SPRAY_FOAM_KIT_COST)} per kit.
                        </p>
                      </div>
                      {(day.materialsUsed || []).map((material) => {
                        const totalCost = toNumber(material.quantity) * toNumber(material.unitCost);
                        return (
                          <div key={material.id} style={{ marginBottom: 12, border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
                            <div className="formGrid">
                              <Field label="Description">
                                <input type="text" value={material.description} onChange={(e) => handleMaterialItemChange(day.id, material.id, "description", e.target.value)} />
                              </Field>
                              <Field label="Quantity">
                                <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={material.quantity} onChange={(e) => handleMaterialItemChange(day.id, material.id, "quantity", toNumber(e.target.value))} />
                              </Field>
                              <Field label="Unit cost">
                                <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={material.unitCost} onChange={(e) => handleMaterialItemChange(day.id, material.id, "unitCost", toNumber(e.target.value))} />
                              </Field>
                              <Field label="Total cost">
                                <input type="number" onWheel={handleNumberInputWheel} value={round(totalCost, 2)} disabled />
                              </Field>
                            </div>
                            <div className="actionRow" style={{ marginTop: 12 }}>
                              <button type="button" className="secondaryButton" onClick={() => handleRemoveMaterialItem(day.id, material.id)}>
                                Delete material item
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button type="button" className="secondaryButton" onClick={() => handleAddMaterialItem(day.id)}>
                        Add material item
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="formGrid" style={{ marginTop: 12 }}>
                  <Field label="Travel / fuel">
                    <div>
                      {(day.travelRows || []).map((travel) => {
                        const travelCost = calculateDailyTravelCost(travel);
                        return (
                          <div key={travel.id} style={{ marginBottom: 12, border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
                            <div className="formGrid">
                              <Field label="Vehicle">
                                <select value={travel.vehicleKey || ""} onChange={(e) => handleDailyTravelRowChange(day.id, travel.id, "vehicleKey", e.target.value)}>
                                  {TRAVEL_VEHICLE_OPTIONS.map((vehicle) => (
                                    <option key={vehicle.value} value={vehicle.value}>{vehicle.label}</option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Miles driven">
                                <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={travel.milesDriven ?? 0} onChange={(e) => handleDailyTravelRowChange(day.id, travel.id, "milesDriven", Math.max(0, toNumber(e.target.value)))} />
                              </Field>
                              <Field label="Vehicle MPG">
                                <input type="number" onWheel={handleNumberInputWheel} min="0.1" step="0.1" value={travel.mpg ?? 0} onChange={(e) => handleDailyTravelRowChange(day.id, travel.id, "mpg", Math.max(0.1, toNumber(e.target.value)))} />
                              </Field>
                              <Field label="Fuel price per gallon">
                                <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={travel.fuelCostPerGallon ?? 0} onChange={(e) => handleDailyTravelRowChange(day.id, travel.id, "fuelCostPerGallon", Math.max(0, toNumber(e.target.value)))} />
                              </Field>
                              <Field label="Estimated gallons used">
                                <input type="text" value={round(travelCost.estimatedFuelGallons, 2)} disabled />
                              </Field>
                              <Field label="Calculated fuel cost">
                                <input type="text" value={money2(travelCost.fuelCost)} disabled />
                              </Field>
                              <Field label="Tolls, parking, lodging, or other travel">
                                <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={travel.otherTravelCost ?? 0} onChange={(e) => handleDailyTravelRowChange(day.id, travel.id, "otherTravelCost", Math.max(0, toNumber(e.target.value)))} />
                              </Field>
                              <Field label="Total travel / fuel cost">
                                <input type="text" value={money2(travelCost.totalTravelCost)} disabled />
                              </Field>
                            </div>
                            <div className="actionRow" style={{ marginTop: 12 }}>
                              <button type="button" className="secondaryButton" onClick={() => handleRemoveDailyTravelRow(day.id, travel.id)}>Delete travel row</button>
                            </div>
                          </div>
                        );
                      })}
                      <button type="button" className="secondaryButton" onClick={() => handleAddDailyTravelRow(day.id)}>Add vehicle / trip</button>
                      <p className="smallNote" style={{ marginTop: 8 }}>Fuel is calculated as miles driven ÷ MPG × fuel price per gallon.</p>
                    </div>
                  </Field>
                </div>

                <div className="formGrid" style={{ marginTop: 12 }}>
                  <Field label="Notes">
                    <textarea rows="3" value={day.notes} onChange={(e) => handleDailyProgressFieldChange(day.id, "notes", e.target.value)} />
                  </Field>
                  <Field label="Issues / delays">
                    <textarea rows="3" value={day.issues} onChange={(e) => handleDailyProgressFieldChange(day.id, "issues", e.target.value)} />
                  </Field>
                </div>

                <Section title="Attachments" subtitle="Upload photos or documents for this workday.">
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/heic,.pdf,.doc,.docx"
                    disabled={approvedAttachmentUploadingDayIds.includes(day.id)}
                    onChange={(event) => handleApprovedProgressAttachmentUpload(day.id, event)}
                  />
                  <p className="smallNote">
                    {approvedAttachmentUploadingDayIds.includes(day.id)
                      ? "Uploading attachments..."
                      : "JPG, PNG, WebP, HEIC, PDF, DOC, or DOCX files up to 15 MB each."}
                  </p>
                  {(day.attachments || []).length ? (
                    <div className="savedList" style={{ marginTop: 12 }}>
                      {(day.attachments || []).map((attachment) => (
                        <div className="savedCard" key={attachment.id}>
                          <div>
                            <strong>{attachment.fileName || "Attachment"}</strong>
                            <p>
                              {formatAttachmentSize(attachment.fileSize)}
                              {attachment.uploadedBy ? ` · Uploaded by ${attachment.uploadedBy}` : ""}
                            </p>
                          </div>
                          <div className="savedActions">
                            <button type="button" className="secondaryButton" onClick={() => handleOpenApprovedProgressAttachment(attachment)}>
                              Open / Download
                            </button>
                            {canManageSharedJobData && String(attachment.storagePath || "").startsWith(`${authUser?.key}/`) ? (
                              <button type="button" className="dangerButton" onClick={() => handleRemoveApprovedProgressAttachment(day.id, attachment)}>
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="emptyState">No attachments uploaded for this day.</p>
                  )}
                </Section>
                </div>
                ) : null}
              </div>
              );
            })
          ) : (
            <p className="emptyState">No daily logs added yet.</p>
          )}
        </Section>

        <Section title="Progress totals" subtitle="Aggregated totals from all logged days.">
          <div className="detailList">
            <div className="detailRow">
              <span>Total job days</span>
              <strong>{totals.totalJobDays}</strong>
            </div>
            <div className="detailRow">
              <span>Total actual labor hours</span>
              <strong>{round(totals.totalActualLaborHours, 2)}</strong>
            </div>
            {!isProjectManager ? (
              <>
                <div className="detailRow">
                  <span>Total base payroll</span>
                  <strong>{money2(totals.totalActualBasePayroll)}</strong>
                </div>
                <div className="detailRow">
                  <span>Workers’ compensation (50%)</span>
                  <strong>{money2(totals.totalWorkersCompCost)}</strong>
                </div>
                <div className="detailRow">
                  <span>Payroll tax ({payrollTaxPercentLabel})</span>
                  <strong>{money2(totals.totalPayrollTaxCost)}</strong>
                </div>
              </>
            ) : null}
            {!isProjectManager ? (
              <div className="detailRow">
                <span>Total loaded labor cost</span>
                <strong>{money2(totals.totalActualLaborCost)}</strong>
              </div>
            ) : null}
            <div className="detailRow">
              <span>Total subcontractor cost</span>
              <strong>{money2(totals.totalSubcontractorCost)}</strong>
            </div>
            <div className="detailRow">
              <span>Total travel miles</span>
              <strong>{round(totals.totalTravelMiles, 2)}</strong>
            </div>
            <div className="detailRow">
              <span>Estimated fuel gallons used</span>
              <strong>{round(totals.totalFuelGallons, 2)}</strong>
            </div>
            <div className="detailRow">
              <span>Total fuel cost</span>
              <strong>{money2(totals.totalFuelCost)}</strong>
            </div>
            <div className="detailRow">
              <span>Other travel costs</span>
              <strong>{money2(totals.totalOtherTravelCost)}</strong>
            </div>
            <div className="detailRow">
              <span>Total travel / fuel cost</span>
              <strong>{money2(totals.totalTravelCost)}</strong>
            </div>
            <div className="detailRow">
              <span>Total spray foam gallons used</span>
              <strong>{round(totals.totalSprayFoamGallonsUsed, 2)}</strong>
            </div>
            <div className="detailRow">
              <span>Equivalent spray foam kits ({SPRAY_FOAM_GALLONS_PER_KIT} gal/kit)</span>
              <strong>{round(totals.totalSprayFoamEquivalentKits, 3)}</strong>
            </div>
            <div className="detailRow">
              <span>Total spray foam cost</span>
              <strong>{money2(totals.totalSprayFoamCost)}</strong>
            </div>
            <div className="detailRow">
              <span>Total material cost</span>
              <strong>{money2(totals.totalMaterialCost)}</strong>
            </div>
            {!isProjectManager ? (
              <div className="detailRow">
                <span>Direct cost before operating / overhead</span>
                <strong>{money2(totals.directActualCost)}</strong>
              </div>
            ) : null}
            {!isProjectManager ? (
              <>
                <div className="detailRow">
                  <span>Operating / overhead cost ({APPROVED_JOB_OPERATING_OVERHEAD_RATE * 100}%)</span>
                  <strong>{money2(totals.operatingOverheadCost)}</strong>
                </div>
                <div className="detailRow">
                  <span>Total cost including operating / overhead</span>
                  <strong>{money2(totals.runningActualCost)}</strong>
                </div>
                <div className="detailRow"><span>Approved sale price</span><strong>{money2(financialSummary.approvedSalePrice)}</strong></div>
                <div className="detailRow"><span>Change orders (if any)</span><strong>{money2(financialSummary.changeOrders)}</strong></div>
                <div className="detailRow"><span>Total sale price (including change orders)</span><strong>{money2(financialSummary.totalSalePrice)}</strong></div>
                <div className="detailRow"><span>Other job costs</span><strong>{money2(financialSummary.otherJobCosts)}</strong></div>
                <div className="detailRow"><span>Gross profit before operating / overhead</span><strong>{money2(financialSummary.grossProfitBeforeOverhead)}</strong></div>
                <div className="detailRow"><span>Commissionable gross profit after operating / overhead</span><strong>{money2(financialSummary.commissionableGrossProfit)}</strong></div>
                <div className="detailRow"><span>Sales commission ({round(financialSummary.salesCommissionRate * 100, 2)}%)</span><strong>{money2(financialSummary.salesCommission)}</strong></div>
                <div className="detailRow"><span>Total fully loaded cost</span><strong>{money2(financialSummary.fullyLoadedCost)}</strong></div>
                <div className="detailRow"><span>Net company profit</span><strong>{money2(financialSummary.netCompanyProfit)}</strong></div>
                <div className="detailRow"><span>Net company profit margin</span><strong>{financialSummary.netCompanyMarginPercent}%</strong></div>
              </>
            ) : null}
          </div>
        </Section>

        <div className="actionRow" style={{ marginTop: 16 }}>
          <button type="button" className="primaryButton" onClick={handleSaveApprovedJob}>
            Save daily progress
          </button>
          {sessionMessageType === "success" && sessionMessage === "Saved" ? (
            <strong role="status" aria-live="polite" style={{ color: "#2e7d32" }}>Saved</strong>
          ) : null}
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate(dailyCostReturnTemplate)}>Cancel</button>
        </div>
      </div>
    );
  
}
