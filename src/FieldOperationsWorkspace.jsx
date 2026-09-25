export default function FieldOperationsWorkspace({ workspace }) {
 const { discardPendingFieldUpload, fieldUploadBusy, pendingFieldUploads, retryFieldUploads, fieldDailyLogSaving, DetailRow, FIELD_DAILY_LOG_HIGH_MILEAGE_THRESHOLD, FIELD_DAILY_LOG_PHOTO_CATEGORIES, Field, LOGO_SRC, Section, activeEmployeeDrivers, activeFieldOperationEmployees, activeFieldOperationForemen, authUser, calculateFieldDailyLogTotals, calculateHoursBetweenTimes, css, fieldDailyLogDraft, fieldDailyLogFilters, fieldDailyLogHasProgressOrCompletedPhoto, fieldDailyLogReviewSearch, fieldDailyLogSelectedId, fieldDailyLogSelectedLog, fieldOperationCompanyVehicles, fieldOperationsTab, filteredFieldDailyLogs, getAccountTitle, handleAddFieldDailyLogCrewRow, handleAddFieldDailyLogFuelReceiptRow, handleAddFieldDailyLogVehicleRow, handleExportPayrollCsv, handleFieldDailyLogCrewRowChange, handleFieldDailyLogFieldChange, handleFieldDailyLogFilterChange, handleFieldDailyLogFuelReceiptPhotoUpload, handleFieldDailyLogFuelReceiptRowChange, handleFieldDailyLogPhotoUpload, handleFieldDailyLogVehicleRowChange, handleNumberInputWheel, handleRemoveFieldDailyLogCrewRow, handleRemoveFieldDailyLogFuelReceiptRow, handleRemoveFieldDailyLogPhoto, handleRemoveFieldDailyLogVehicleRow, handleRemoveFuelReceiptPhoto, handleSaveFieldDailyLogDraft, handleSubmitDailyLog, money2, num, requestPhotoAccessAndOpenPicker, round, setActiveTemplate, setFieldDailyLogReviewSearch, setFieldDailyLogSelectedId, setFieldOperationsTab, toNumber, totalFuelPurchasedAmount } = workspace;

    const draftTotals = calculateFieldDailyLogTotals(fieldDailyLogDraft);
    const employeeDropdownOptions = [
      { value: "", label: activeFieldOperationEmployees.length ? "Select employee" : "No active employees found" },
      ...activeFieldOperationEmployees.map((employee) => ({
        value: employee.id,
        label: [
          employee.displayName || `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || "Unnamed employee",
          employee.employeeNumber ? `ID ${employee.employeeNumber}` : "",
          employee.occupation ? employee.occupation : "",
        ]
          .filter(Boolean)
          .join(" • "),
      })),
    ];
    const vehicleDropdownOptions = [
      { value: "", label: fieldOperationCompanyVehicles.length ? "Select truck driven" : "No company vehicles found" },
      ...fieldOperationCompanyVehicles.map((vehicle) => ({
        value: vehicle.id,
        label: [
          vehicle.vehicleName || "Company vehicle",
          vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : "",
          vehicle.licensePlate ? `Plate ${vehicle.licensePlate}` : "",
        ]
          .filter(Boolean)
          .join(" • "),
      })),
      { value: "__other__", label: "Other / Rental" },
    ];
    const photoGroups = FIELD_DAILY_LOG_PHOTO_CATEGORIES.map((category) => ({
      ...category,
      photos: (fieldDailyLogDraft.photos || []).filter((photo) => String(photo.photoCategory || "").toLowerCase() === category.value),
    }));

    return (
      <div className="appShell">
        <style>{css}</style>
        {fieldUploadBusy ? <p role="status">Uploading photos… Keep this page open.</p> : null}
        {pendingFieldUploads.length ? <div role="alert"><p>{pendingFieldUploads.length} upload(s) failed. Files remain available here until you close this page.</p>{pendingFieldUploads.map(item => <p key={item.id}>{item.file.name}: {item.error} <button type="button" className="secondaryButton" disabled={fieldUploadBusy} onClick={() => discardPendingFieldUpload(item.id)}>Remove failed file</button></p>)}<button type="button" className="primaryButton" disabled={fieldUploadBusy} onClick={retryFieldUploads}>Retry failed uploads</button></div> : null}

        <header className="hero">
          <div>
            <div className="brandRow">
              <div className="brandMark">
                <img src={LOGO_SRC} alt="CRT Roofing logo" />
              </div>
              <div>
                <p className="eyebrow">CRT Roofing Operations Platform</p>
                <h1>Field Operations</h1>
                <p className="intro">Daily Job Log for foremen and office review for submitted field work.</p>
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
        </div>

        <Section title="Field Operations" subtitle="Phase 1: create daily logs, save drafts, submit logs, and review submitted work.">
          <div className="dashboardTabBar">
            <button
              type="button"
              className={`dashboardTabButton ${fieldOperationsTab === "dailyLog" ? "active" : ""}`}
              onClick={() => setFieldOperationsTab("dailyLog")}
            >
              Daily Job Log
            </button>
            <button
              type="button"
              className={`dashboardTabButton ${fieldOperationsTab === "officeReview" ? "active" : ""}`}
              onClick={() => setFieldOperationsTab("officeReview")}
            >
              Office Review
            </button>
          </div>

          <p className="smallNote">
            Foremen can save drafts and submit logs. Submitted logs are locked in the office review list so they cannot be overwritten directly.
          </p>
        </Section>

        {fieldOperationsTab === "dailyLog" ? (
          <>
            <Section title="Daily Job Log" subtitle="Capture the day’s field work, hours, materials, equipment, notes, and photos.">
              <div className="formGrid">
                <Field label="Job number">
                  <input type="text" value={fieldDailyLogDraft.jobNumber} onChange={(e) => handleFieldDailyLogFieldChange("jobNumber", e.target.value)} />
                </Field>
                <Field label="Job name">
                  <input type="text" value={fieldDailyLogDraft.jobName} onChange={(e) => handleFieldDailyLogFieldChange("jobName", e.target.value)} />
                </Field>
                <Field label="Job address">
                  <input type="text" value={fieldDailyLogDraft.jobAddress} onChange={(e) => handleFieldDailyLogFieldChange("jobAddress", e.target.value)} />
                </Field>
                <Field label="Work date">
                  <input type="date" value={fieldDailyLogDraft.workDate} onChange={(e) => handleFieldDailyLogFieldChange("workDate", e.target.value)} />
                </Field>
                <Field label="Foreman">
                  <select
                    value={fieldDailyLogDraft.foreman}
                    onChange={(e) => handleFieldDailyLogFieldChange("foreman", e.target.value)}
                  >
                    <option value="">{activeFieldOperationForemen.length ? "Select foreman" : "No active foremen found"}</option>
                    {activeFieldOperationForemen.map((employee) => {
                      const fullName = employee.displayName || [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim() || "Unnamed foreman";
                      return (
                        <option key={employee.id} value={fullName}>
                          {fullName}
                          {employee.employeeNumber ? ` • ID ${employee.employeeNumber}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </Field>
                <Field label="Weather conditions (optional)">
                  <input type="text" value={fieldDailyLogDraft.weatherConditions} onChange={(e) => handleFieldDailyLogFieldChange("weatherConditions", e.target.value)} />
                </Field>
              </div>
            </Section>

            <Section
              title="Vehicle & Fuel"
              subtitle="Track the truck driven, mileage, fuel purchases, and receipt photos."
            >
              <div className="formGrid">
                <Field label="Was fuel purchased?">
                  <select value={fieldDailyLogDraft.fuelPurchased ? "yes" : "no"} onChange={(e) => handleFieldDailyLogFieldChange("fuelPurchased", e.target.value === "yes")}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              </div>

              <div className="crewLogList" style={{ marginTop: 14 }}>
                {(fieldDailyLogDraft.vehicleRows || []).map((row) => {
                  const milesDriven = Math.max(0, toNumber(row.endingMileage, 0) - toNumber(row.startingMileage, 0));
                  const mileageFlag = toNumber(row.endingMileage, 0) < toNumber(row.startingMileage, 0) || milesDriven >= FIELD_DAILY_LOG_HIGH_MILEAGE_THRESHOLD;
                  return (
                    <div key={row.id} className="panel" style={{ marginBottom: 12, padding: 16 }}>
                      <div className="formGrid">
                        <Field label="Truck driven">
                          <select value={row.vehicleId} onChange={(e) => handleFieldDailyLogVehicleRowChange(row.id, "vehicleId", e.target.value)}>
                            {vehicleDropdownOptions.map((option) => (
                              <option key={option.value || "blank"} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Truck driver">
                          <select value={row.driverEmployeeId} onChange={(e) => handleFieldDailyLogVehicleRowChange(row.id, "driverEmployeeId", e.target.value)}>
                            <option value="">Select driver</option>
                            {activeEmployeeDrivers.map((employee) => {
                              const fullName = employee.displayName || [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim() || "Unnamed driver";
                              return (
                                <option key={employee.id} value={employee.id}>
                                  {fullName}
                                  {employee.employeeNumber ? ` • ID ${employee.employeeNumber}` : ""}
                                </option>
                              );
                            })}
                          </select>
                        </Field>
                        <Field label="Truck name">
                          <input type="text" value={row.truckName} onChange={(e) => handleFieldDailyLogVehicleRowChange(row.id, "truckName", e.target.value)} />
                        </Field>
                        <Field label="Unit number">
                          <input type="text" value={row.unitNumber} onChange={(e) => handleFieldDailyLogVehicleRowChange(row.id, "unitNumber", e.target.value)} />
                        </Field>
                        <Field label="License plate">
                          <input type="text" value={row.licensePlate} onChange={(e) => handleFieldDailyLogVehicleRowChange(row.id, "licensePlate", e.target.value)} />
                        </Field>
                        <Field label="Starting mileage">
                          <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={row.startingMileage} onChange={(e) => handleFieldDailyLogVehicleRowChange(row.id, "startingMileage", toNumber(e.target.value))} />
                        </Field>
                        <Field label="Ending mileage">
                          <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={row.endingMileage} onChange={(e) => handleFieldDailyLogVehicleRowChange(row.id, "endingMileage", toNumber(e.target.value))} />
                        </Field>
                        <Field label="Calculated miles driven">
                          <input type="number" onWheel={handleNumberInputWheel} value={milesDriven} disabled />
                        </Field>
                        <Field label="Rental / other notes (optional)">
                          <input type="text" value={row.otherDescription} onChange={(e) => handleFieldDailyLogVehicleRowChange(row.id, "otherDescription", e.target.value)} placeholder="Rental company or notes" />
                        </Field>
                      </div>
                      <div className="detailList" style={{ marginTop: 12 }}>
                        <DetailRow label="Mileage validation" value={toNumber(row.endingMileage, 0) < toNumber(row.startingMileage, 0) ? "Ending mileage must be greater than starting mileage." : mileageFlag ? "High mileage flagged for office review." : "Mileage looks good."} />
                      </div>
                      <div className="actionRow" style={{ marginTop: 12 }}>
                        <button type="button" className="dangerButton" onClick={() => handleRemoveFieldDailyLogVehicleRow(row.id)}>
                          Remove vehicle
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="actionRow" style={{ marginTop: 12 }}>
                <button type="button" className="secondaryButton" onClick={handleAddFieldDailyLogVehicleRow}>
                  + Add Truck
                </button>
              </div>
              <div className="detailList" style={{ marginTop: 14 }}>
                <DetailRow label="Total vehicle miles driven" value={num(draftTotals.vehicleMilesDriven, 0)} />
                <DetailRow label="High mileage flags" value={num(draftTotals.highMileageCount, 0)} />
              </div>

              {fieldDailyLogDraft.fuelPurchased ? (
                <>
                  <div className="detailList" style={{ marginTop: 14 }}>
                    <DetailRow label="Fuel receipts total" value={money2(totalFuelPurchasedAmount)} />
                    <DetailRow label="Fuel gallons total" value={num(draftTotals.totalFuelGallons, 2)} />
                  </div>
                  <div className="crewLogList" style={{ marginTop: 14 }}>
                    {(fieldDailyLogDraft.fuelReceipts || []).map((row) => (
                      <div key={row.id} className="panel" style={{ marginBottom: 12, padding: 16 }}>
                        <div className="formGrid">
                          <Field label="Truck driven">
                            <select value={row.vehicleRowId} onChange={(e) => handleFieldDailyLogFuelReceiptRowChange(row.id, "vehicleRowId", e.target.value)}>
                              <option value="">Select truck</option>
                              {(fieldDailyLogDraft.vehicleRows || []).map((vehicleRow) => (
                                <option key={vehicleRow.id} value={vehicleRow.id}>
                                  {vehicleRow.truckName || "Truck"} {vehicleRow.unitNumber ? `• Unit ${vehicleRow.unitNumber}` : ""}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Gallons pumped">
                            <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={row.gallonsPumped} onChange={(e) => handleFieldDailyLogFuelReceiptRowChange(row.id, "gallonsPumped", toNumber(e.target.value))} />
                          </Field>
                          <Field label="Total receipt amount">
                            <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={row.totalReceiptAmount} onChange={(e) => handleFieldDailyLogFuelReceiptRowChange(row.id, "totalReceiptAmount", toNumber(e.target.value))} />
                          </Field>
                          <Field label="Price per gallon">
                            <input type="number" onWheel={handleNumberInputWheel} value={row.pricePerGallon} disabled />
                          </Field>
                          <Field label="Fuel station (optional)">
                            <input type="text" value={row.fuelStation} onChange={(e) => handleFieldDailyLogFuelReceiptRowChange(row.id, "fuelStation", e.target.value)} />
                          </Field>
                          <Field label="Receipt date/time">
                            <input type="datetime-local" value={row.receiptDateTime} onChange={(e) => handleFieldDailyLogFuelReceiptRowChange(row.id, "receiptDateTime", e.target.value)} />
                          </Field>
                          <Field label="Gas receipt photo upload">
                            <button
                              type="button"
                              className="secondaryButton"
                              onClick={() =>
                                requestPhotoAccessAndOpenPicker({
                                  accept: "image/*",
                                  multiple: false,
                                  onChange: (event) => handleFieldDailyLogFuelReceiptPhotoUpload(row.id, event),
                                })
                              }
                            >
                              Upload receipt photo
                            </button>
                          </Field>
                          <Field label="Receipt photo">
                            {row.receiptPhotoUrl ? (
                              <div className="photoPreviewCard">
                                <img src={row.receiptPhotoUrl} alt={row.receiptPhotoName || "Fuel receipt"} />
                                <div className="photoPreviewMeta">
                                  <strong>{row.receiptPhotoName || "Receipt photo"}</strong>
                                  <button type="button" className="secondaryButton" onClick={() => handleRemoveFuelReceiptPhoto(row.id)}>
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="emptyState">No receipt photo uploaded.</p>
                            )}
                          </Field>
                        </div>
                        <div className="actionRow" style={{ marginTop: 12 }}>
                          <button type="button" className="dangerButton" onClick={() => handleRemoveFieldDailyLogFuelReceiptRow(row.id)}>
                            Remove receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="actionRow" style={{ marginTop: 12 }}>
                    <button type="button" className="secondaryButton" onClick={handleAddFieldDailyLogFuelReceiptRow}>
                      + Add Gas Receipt
                    </button>
                  </div>
                </>
              ) : (
                <p className="emptyState" style={{ marginTop: 14 }}>
                  Toggle fuel purchase to add one or more gas receipts.
                </p>
              )}
            </Section>

            <Section
              title="Workday Time"
              subtitle="Track the shift timing for the day and show the total time on site."
            >
              <div className="formGrid">
                <Field label="Job start time">
                  <input type="time" value={fieldDailyLogDraft.jobStartTime} onChange={(e) => handleFieldDailyLogFieldChange("jobStartTime", e.target.value)} />
                </Field>
                <Field label="Lunch start time">
                  <input type="time" value={fieldDailyLogDraft.lunchStartTime} onChange={(e) => handleFieldDailyLogFieldChange("lunchStartTime", e.target.value)} />
                </Field>
                <Field label="Lunch end time">
                  <input type="time" value={fieldDailyLogDraft.lunchEndTime} onChange={(e) => handleFieldDailyLogFieldChange("lunchEndTime", e.target.value)} />
                </Field>
                <Field label="Job end time">
                  <input type="time" value={fieldDailyLogDraft.jobEndTime} onChange={(e) => handleFieldDailyLogFieldChange("jobEndTime", e.target.value)} />
                </Field>
              </div>
              <div className="detailList" style={{ marginTop: 14 }}>
                <DetailRow label="Calculated lunch duration" value={num(draftTotals.calculatedLunchDurationHours, 2)} />
                <DetailRow label="Calculated total time on site" value={num(draftTotals.calculatedTimeOnSiteHours, 2)} />
              </div>
            </Section>

            <Section
              title="Employee Crew"
              subtitle="Add each employee, their timing, hours, and role for the day."
              right={<button type="button" className="secondaryButton" onClick={handleAddFieldDailyLogCrewRow}>+ Add Crew Member</button>}
            >
              <div className="crewLogList">
                {(fieldDailyLogDraft.crewRows || []).map((row) => {
                  const shiftHours = Math.max(0, calculateHoursBetweenTimes(row.startTime, row.endTime) - Math.max(0, toNumber(row.lunchDurationHours, 0)));
                  return (
                    <div key={row.id} className="panel" style={{ marginBottom: 12, padding: 16 }}>
                      <div className="formGrid">
                        <Field label="Employee name dropdown">
                          <select value={row.employeeLookupId} onChange={(e) => handleFieldDailyLogCrewRowChange(row.id, "employeeLookupId", e.target.value)}>
                            {employeeDropdownOptions.map((option) => (
                              <option key={option.value || "blank"} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Employee ID (optional)">
                          <input type="text" value={row.employeeId} onChange={(e) => handleFieldDailyLogCrewRowChange(row.id, "employeeId", e.target.value)} />
                        </Field>
                        <Field label="Start time">
                          <input type="time" value={row.startTime} onChange={(e) => handleFieldDailyLogCrewRowChange(row.id, "startTime", e.target.value)} />
                        </Field>
                        <Field label="End time">
                          <input type="time" value={row.endTime} onChange={(e) => handleFieldDailyLogCrewRowChange(row.id, "endTime", e.target.value)} />
                        </Field>
                        <Field label="Lunch duration">
                          <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.25" value={row.lunchDurationHours} onChange={(e) => handleFieldDailyLogCrewRowChange(row.id, "lunchDurationHours", toNumber(e.target.value))} />
                        </Field>
                        <Field label="Shift duration reference">
                          <input type="number" onWheel={handleNumberInputWheel} value={round(shiftHours, 2)} disabled />
                        </Field>
                        <Field label="Regular hours">
                          <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.25" value={row.regularHours} onChange={(e) => handleFieldDailyLogCrewRowChange(row.id, "regularHours", toNumber(e.target.value))} />
                        </Field>
                        <Field label="Overtime hours">
                          <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.25" value={row.overtimeHours} onChange={(e) => handleFieldDailyLogCrewRowChange(row.id, "overtimeHours", toNumber(e.target.value))} />
                        </Field>
                        <Field label="Double-time hours">
                          <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.25" value={row.doubleTimeHours} onChange={(e) => handleFieldDailyLogCrewRowChange(row.id, "doubleTimeHours", toNumber(e.target.value))} />
                        </Field>
                        <Field label="Employee role / classification (optional)">
                          <input type="text" value={row.role} onChange={(e) => handleFieldDailyLogCrewRowChange(row.id, "role", e.target.value)} />
                        </Field>
                      </div>
                      <div className="actionRow" style={{ marginTop: 12 }}>
                        <button type="button" className="dangerButton" onClick={() => handleRemoveFieldDailyLogCrewRow(row.id)}>
                          Remove employee
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="detailList">
                <DetailRow label="Total regular hours" value={num(draftTotals.totalRegularHours, 2)} />
                <DetailRow label="Total overtime hours" value={num(draftTotals.totalOvertimeHours, 2)} />
                <DetailRow label="Total double-time hours" value={num(draftTotals.totalDoubleTimeHours, 2)} />
                <DetailRow label="Total crew hours" value={num(draftTotals.totalCrewHours, 2)} />
              </div>
            </Section>

            <Section title="Daily Work Details" subtitle="Summarize what was completed and anything the office should know.">
              <div className="formGrid">
                <Field label="Work completed">
                  <textarea rows="4" value={fieldDailyLogDraft.workCompleted} onChange={(e) => handleFieldDailyLogFieldChange("workCompleted", e.target.value)} />
                </Field>
                <Field label="Materials used">
                  <textarea rows="4" value={fieldDailyLogDraft.materialsUsedText} onChange={(e) => handleFieldDailyLogFieldChange("materialsUsedText", e.target.value)} />
                </Field>
                <Field label="Equipment used">
                  <textarea rows="4" value={fieldDailyLogDraft.equipmentUsed} onChange={(e) => handleFieldDailyLogFieldChange("equipmentUsed", e.target.value)} />
                </Field>
                <Field label="Delays or problems">
                  <textarea rows="4" value={fieldDailyLogDraft.delaysOrProblems} onChange={(e) => handleFieldDailyLogFieldChange("delaysOrProblems", e.target.value)} />
                </Field>
                <Field label="Safety incidents?">
                  <select
                    value={fieldDailyLogDraft.safetyIncidents ? "yes" : "no"}
                    onChange={(e) => handleFieldDailyLogFieldChange("safetyIncidents", e.target.value === "yes")}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
                <Field label="Additional notes">
                  <textarea rows="4" value={fieldDailyLogDraft.additionalNotes} onChange={(e) => handleFieldDailyLogFieldChange("additionalNotes", e.target.value)} />
                </Field>
              </div>
            </Section>

            <Section
              title="Photos"
              subtitle="Upload multiple photos for each job stage. At least one progress or completed-work photo is required before submission."
            >
              <div className="photoUploadGrid">
                {photoGroups.map((group) => (
                  <div className="photoUploadCard" key={group.value}>
                    <Field label={group.label}>
                      <button
                        type="button"
                        className="secondaryButton"
                        disabled={fieldUploadBusy || fieldDailyLogSaving}
                        onClick={() =>
                          requestPhotoAccessAndOpenPicker({
                            accept: "image/*",
                            multiple: true,
                            onChange: (event) => handleFieldDailyLogPhotoUpload(group.value, event),
                          })
                        }
                      >
                        Upload photos from device
                      </button>
                    </Field>
                    <div className="photoPreviewGrid">
                      {group.photos.length ? (
                        group.photos.map((photo) => (
                          <div key={photo.id} className="photoPreviewCard">
                            {photo.photoUrl ? <img src={photo.photoUrl} alt={photo.fileName || group.label} /> : <div className="photoFallback">No preview</div>}
                            <div className="photoPreviewMeta">
                              <strong>{photo.fileName || "Photo"}</strong>
                              <button type="button" className="secondaryButton" onClick={() => handleRemoveFieldDailyLogPhoto(photo.id)}>
                                Remove
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="emptyState">No {group.label.toLowerCase()} uploaded yet.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Submission" subtitle="Save a draft or submit the daily log for office review.">
              <div className="detailList" style={{ marginBottom: 16 }}>
                <DetailRow label="Draft photo count" value={num(draftTotals.photoCount, 0)} />
                <DetailRow label="Required submission photos" value={fieldDailyLogHasProgressOrCompletedPhoto(fieldDailyLogDraft) ? "Ready" : "Need one progress or completed photo"} />
              </div>
              <div className="actionRow">
                <button type="button" className="primaryButton" disabled={fieldDailyLogSaving || fieldUploadBusy || pendingFieldUploads.length > 0} onClick={handleSaveFieldDailyLogDraft}>
                  Save Draft
                </button>
                <button type="button" className="secondaryButton" disabled={fieldDailyLogSaving || fieldUploadBusy || pendingFieldUploads.length > 0} onClick={handleSubmitDailyLog}>
                  Submit Daily Log
                </button>
              </div>
            </Section>
          </>
        ) : (
          <>
            <Section
              title="Office Review"
              subtitle="Review submitted logs, filter by job details, and inspect hours, photos, fuel, and notes."
              right={<button type="button" className="secondaryButton" onClick={handleExportPayrollCsv}>Export Payroll CSV</button>}
            >
              <div className="formGrid">
                <Field label="Search">
                  <input type="text" value={fieldDailyLogReviewSearch} onChange={(e) => setFieldDailyLogReviewSearch(e.target.value)} placeholder="Search logs, crew, notes, or materials" />
                </Field>
                <Field label="Date start">
                  <input type="date" value={fieldDailyLogFilters.dateStart} onChange={(e) => handleFieldDailyLogFilterChange("dateStart", e.target.value)} />
                </Field>
                <Field label="Date end">
                  <input type="date" value={fieldDailyLogFilters.dateEnd} onChange={(e) => handleFieldDailyLogFilterChange("dateEnd", e.target.value)} />
                </Field>
                <Field label="Job">
                  <input type="text" value={fieldDailyLogFilters.job} onChange={(e) => handleFieldDailyLogFilterChange("job", e.target.value)} placeholder="Job number or name" />
                </Field>
                <Field label="Foreman">
                  <input type="text" value={fieldDailyLogFilters.foreman} onChange={(e) => handleFieldDailyLogFilterChange("foreman", e.target.value)} />
                </Field>
                <Field label="Employee">
                  <input type="text" value={fieldDailyLogFilters.employee} onChange={(e) => handleFieldDailyLogFilterChange("employee", e.target.value)} placeholder="Search crew member" />
                </Field>
                <Field label="Status">
                  <select value={fieldDailyLogFilters.status} onChange={(e) => handleFieldDailyLogFilterChange("status", e.target.value)}>
                    <option value="all">All</option>
                    <option value="draft">Draft</option>
                    <option value="submitted">Submitted</option>
                  </select>
                </Field>
              </div>

              <div className="actionRow" style={{ marginTop: 12 }}>
                <label className="statusTag" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={fieldDailyLogFilters.missingPhotos} onChange={(e) => handleFieldDailyLogFilterChange("missingPhotos", e.target.checked)} />
                  Missing photos
                </label>
                <label className="statusTag" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={fieldDailyLogFilters.hasOvertime} onChange={(e) => handleFieldDailyLogFilterChange("hasOvertime", e.target.checked)} />
                  Has overtime
                </label>
                <label className="statusTag" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={fieldDailyLogFilters.hasSafetyIncident} onChange={(e) => handleFieldDailyLogFilterChange("hasSafetyIncident", e.target.checked)} />
                  Has safety incident
                </label>
              </div>
            </Section>

            <Section title="Daily logs" subtitle="Click a log to review its details.">
              <div className="savedList">
                {filteredFieldDailyLogs.length ? (
                  filteredFieldDailyLogs.map((log) => {
                    const totals = calculateFieldDailyLogTotals(log);
                    const isSelected = fieldDailyLogSelectedId === log.id;
                    return (
                      <button
                        type="button"
                        key={log.id}
                        className={`savedCard logReviewCard ${isSelected ? "selected" : ""}`}
                        onClick={() => setFieldDailyLogSelectedId(log.id)}
                      >
                        <div className="logReviewHeader">
                          <div>
                            <span className="eyebrow">{log.jobNumber || "No job number"}</span>
                            <strong>{log.jobName || "Untitled daily log"}</strong>
                            <p>
                              {log.jobAddress ? `${log.jobAddress} | ` : ""}
                              {log.workDate || "No work date"} | {log.foreman || "No foreman"}
                            </p>
                          </div>
                          <div className={`statusPill ${log.status === "submitted" ? "" : "bad"}`}>{String(log.status || "draft").toUpperCase()}</div>
                        </div>
                        <div className="logReviewSummary">
                          <span>Regular {num(totals.totalRegularHours, 1)}h</span>
                          <span>OT {num(totals.totalOvertimeHours, 1)}h</span>
                          <span>DT {num(totals.totalDoubleTimeHours, 1)}h</span>
                          <span>Crew {num(totals.totalCrewHours, 1)}h</span>
                          <span>Miles {num(totals.vehicleMilesDriven, 0)}</span>
                          <span>Fuel {money2(totals.totalFuelReceipts || 0)}</span>
                          <span>Photos {num(totals.photoCount, 0)}</span>
                          <span>{log.safetyIncidents ? "Safety incident" : "No safety incident"}</span>
                        </div>
                        <p className="logReviewText">{log.workCompleted || "No work details entered yet."}</p>
                      </button>
                    );
                  })
                ) : (
                  <p className="emptyState">No logs match the current filters.</p>
                )}
              </div>
            </Section>

            <Section title="Selected log review" subtitle="Read-only details for office review and future correction handling.">
              {fieldDailyLogSelectedLog ? (
                <>
                  <div className="detailList">
                    <DetailRow label="Job number" value={fieldDailyLogSelectedLog.jobNumber || "—"} />
                    <DetailRow label="Job name" value={fieldDailyLogSelectedLog.jobName || "—"} />
                    <DetailRow label="Job address" value={fieldDailyLogSelectedLog.jobAddress || "—"} />
                    <DetailRow label="Work date" value={fieldDailyLogSelectedLog.workDate || "—"} />
                    <DetailRow label="Foreman" value={fieldDailyLogSelectedLog.foreman || "—"} />
                    <DetailRow label="Status" value={String(fieldDailyLogSelectedLog.status || "draft").toUpperCase()} />
                    <DetailRow label="Submitted at" value={fieldDailyLogSelectedLog.submittedAt ? new Date(fieldDailyLogSelectedLog.submittedAt).toLocaleString() : "Not submitted"} />
                    <DetailRow label="Submitted by" value={fieldDailyLogSelectedLog.submittedBy || "—"} />
                    <DetailRow label="Device identifier" value={fieldDailyLogSelectedLog.deviceIdentifier || "—"} />
                    <DetailRow label="Photo count" value={num(fieldDailyLogSelectedLog.photoCount || 0, 0)} />
                    <DetailRow label="Regular hours" value={num(fieldDailyLogSelectedLog.totalRegularHours || 0, 2)} />
                    <DetailRow label="Overtime hours" value={num(fieldDailyLogSelectedLog.totalOvertimeHours || 0, 2)} />
                    <DetailRow label="Double-time hours" value={num(fieldDailyLogSelectedLog.totalDoubleTimeHours || 0, 2)} />
                    <DetailRow label="Total crew hours" value={num(fieldDailyLogSelectedLog.totalCrewHours || 0, 2)} />
                    <DetailRow label="Total vehicle miles driven" value={num(fieldDailyLogSelectedLog.vehicleMilesDriven || 0, 0)} />
                    <DetailRow label="Total fuel receipts" value={money2(fieldDailyLogSelectedLog.totalFuelReceipts || 0)} />
                    <DetailRow label="Total fuel gallons" value={num(fieldDailyLogSelectedLog.totalFuelGallons || 0, 2)} />
                    <DetailRow label="Calculated lunch duration" value={num(fieldDailyLogSelectedLog.calculatedLunchDurationHours || 0, 2)} />
                    <DetailRow label="Calculated total time on site" value={num(fieldDailyLogSelectedLog.calculatedTimeOnSiteHours || 0, 2)} />
                  </div>

                  <div className="fieldOpsReviewColumns" style={{ marginTop: 14 }}>
                    <div className="panel">
                      <h3>Crew</h3>
                      <div className="reviewTable">
                        {(fieldDailyLogSelectedLog.crewRows || []).length ? (
                          (fieldDailyLogSelectedLog.crewRows || []).map((row) => (
                            <div key={row.id} className="reviewTableRow">
                              <span>{row.employeeName || "Unnamed employee"}</span>
                              <span>{row.role || "No role"}</span>
                              <span>{row.startTime || "—"} to {row.endTime || "—"}</span>
                              <span>Lunch {num(row.lunchDurationHours, 2)}h</span>
                              <span>R {num(row.regularHours, 2)}</span>
                              <span>OT {num(row.overtimeHours, 2)}</span>
                              <span>DT {num(row.doubleTimeHours, 2)}</span>
                            </div>
                          ))
                        ) : (
                          <p className="emptyState">No crew rows saved.</p>
                        )}
                      </div>
                    </div>

                    <div className="panel">
                      <h3>Vehicle & Fuel</h3>
                      {(fieldDailyLogSelectedLog.vehicleRows || []).length ? (
                        <div className="reviewTable">
                          {(fieldDailyLogSelectedLog.vehicleRows || []).map((row) => (
                            <div key={row.id} className="reviewTableRow">
                              <span>{row.truckName || "Truck"}</span>
                              <span>{row.unitNumber || "No unit"}</span>
                              <span>{row.driverEmployeeName || "No driver"}</span>
                              <span>{row.licensePlate || "No plate"}</span>
                              <span>{num(row.startingMileage, 0)} to {num(row.endingMileage, 0)}</span>
                              <span>{num(row.milesDriven, 0)} mi</span>
                              <span>{row.mileageFlag ? "Review" : "OK"}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="emptyState">No vehicle rows recorded.</p>
                      )}
                      <div style={{ marginTop: 12 }}>
                        {(fieldDailyLogSelectedLog.fuelReceipts || []).length ? (
                          <div className="reviewTable">
                            {(fieldDailyLogSelectedLog.fuelReceipts || []).map((row) => (
                              <div key={row.id} className="reviewTableRow">
                                <span>{row.fuelStation || "Fuel receipt"}</span>
                                <span>{num(row.gallonsPumped, 2)} gal</span>
                                <span>{money2(row.totalReceiptAmount || 0)}</span>
                                <span>{money2(row.pricePerGallon || 0)} / gal</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="emptyState">No fuel receipts recorded.</p>
                        )}
                      </div>
                    </div>

                    <div className="panel">
                      <h3>Materials</h3>
                      {(fieldDailyLogSelectedLog.materialsRows || []).length ? (
                        <div className="reviewTable">
                          {(fieldDailyLogSelectedLog.materialsRows || []).map((row) => (
                            <div key={row.id} className="reviewTableRow">
                              <span>{row.materialName || "Material"}</span>
                              <span>{num(row.quantity, 2)} {row.unit || ""}</span>
                              <span>{row.notes || ""}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="emptyState">No materials recorded.</p>
                      )}
                    </div>
                  </div>

                  <div className="fieldOpsReviewColumns" style={{ marginTop: 14 }}>
                    {FIELD_DAILY_LOG_PHOTO_CATEGORIES.map((category) => {
                      const photos = (fieldDailyLogSelectedLog.photos || []).filter((photo) => String(photo.photoCategory || "") === category.value);
                      return (
                        <div key={category.value} className="panel">
                          <h3>{category.label}</h3>
                          {photos.length ? (
                            <div className="photoPreviewGrid">
                              {photos.map((photo) => (
                                <div key={photo.id} className="photoPreviewCard">
                                  {photo.photoUrl ? <img src={photo.photoUrl} alt={photo.fileName || category.label} /> : <div className="photoFallback">No preview</div>}
                                  <div className="photoPreviewMeta">
                                    <strong>{photo.fileName || "Photo"}</strong>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="emptyState">No photos in this category.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Section title="Work notes" subtitle="Summary fields saved with the log.">
                    <div className="detailList">
                      <DetailRow label="Work completed" value={fieldDailyLogSelectedLog.workCompleted || "—"} />
                      <DetailRow label="Materials used" value={fieldDailyLogSelectedLog.materialsUsedText || "—"} />
                      <DetailRow label="Equipment used" value={fieldDailyLogSelectedLog.equipmentUsed || "—"} />
                      <DetailRow label="Delays or problems" value={fieldDailyLogSelectedLog.delaysOrProblems || "—"} />
                      <DetailRow label="Safety incidents" value={fieldDailyLogSelectedLog.safetyIncidents ? "Yes" : "No"} />
                      <DetailRow label="Additional notes" value={fieldDailyLogSelectedLog.additionalNotes || "—"} />
                    </div>
                  </Section>

                  <Section title="Edit history" subtitle="Audit trail for future corrections and office review.">
                    {fieldDailyLogSelectedLog.revisions && fieldDailyLogSelectedLog.revisions.length ? (
                      <div className="reviewTable">
                        {fieldDailyLogSelectedLog.revisions.map((revision) => (
                          <div key={revision.id} className="reviewTableRow">
                            <span>{revision.fieldName}</span>
                            <span>{revision.originalValue || "—"}</span>
                            <span>{revision.updatedValue || "—"}</span>
                            <span>{revision.changedBy || "—"}</span>
                            <span>{revision.reason || "—"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="emptyState">No corrections recorded yet.</p>
                    )}
                  </Section>

                  <p className="smallNote">
                    Submitted logs are locked here. Unlock/correction tools can be added later for office and admin workflows.
                  </p>
                </>
              ) : (
                <p className="emptyState">Select a log from the list to review it here.</p>
              )}
            </Section>
          </>
        )}

        <div className="actionRow" style={{ marginTop: 16 }}>
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  
}
