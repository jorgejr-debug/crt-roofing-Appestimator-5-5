export default function TpoWorkspace({ workspace }) {
  const {
    AC_DETAIL_OPTIONS,
    ChoiceCard,
    DetailRow,
    EXISTING_ROOF_OPTIONS,
    Field,
    JOB_TYPE_OPTIONS,
    LABOR_TYPE_OPTIONS,
    LICENSE_OPTIONS,
    PAYROLL_TAX_RATE,
    R_VALUE_OPTIONS,
    SUBSTRATE_OPTIONS,
    SafeTileSection,
    Section,
    TERMINATION_METHOD_OPTIONS,
    TOTAL_LABOR_BURDEN_RATE,
    TravelCalculator,
    WORKERS_COMP_RATE,
    activeSavedEstimates,
    addCustomMaterial,
    addEstimateLaborEmployee,
    addTravelVehicleSelection,
    buildEmployeeDisplayName,
    buildEstimateName,
    calculateLoadedHourlyWage,
    calculation,
    canManageEmployeeWages,
    companyUserProfiles,
    completedJobs,
    createBlankTerminationRow,
    css,
    deleteCustomMaterial,
    employeeDirectory,
    estimateCode,
    estimateName,
    estimateOwnerAssignments,
    estimateStatusLabel,
    googleDebug,
    handleAddSubcontractorLineItem,
    handleApproveJob,
    handleCalculateDistance,
    handleCompleteJob,
    handleConvertCurrentEstimateToProposal,
    handleConvertEstimateToProposal,
    handleDeleteEstimate,
    handleDownloadEstimatePDF,
    handleEstimateOwnerSelection,
    handleLoadEstimate,
    handleLogout,
    handleNumberInputWheel,
    handleReassignEstimateOwner,
    handleSaveEstimate,
    handleSelectedMarkup,
    inputs,
    isAdminUser,
    isEstimateComplete,
    isLoaded,
    isLookingUpDistance,
    loadError,
    missingScopeChecklist,
    money,
    money2,
    nextEstimateNumber,
    normalizeAppRole,
    normalizeEstimateLaborEmployeeRows,
    num,
    priceFields,
    prices,
    removeEstimateLaborEmployee,
    removeTravelVehicleSelection,
    renderEstimatorShellHeader,
    renderQuickMeasureReviewPanel,
    sessionMessage,
    sessionMessageType,
    setActiveTemplate,
    setEstimateName,
    setField,
    setInputs,
    setPriceField,
    setSubcontractorAddOnItem,
    setTravelField,
    setTravelVehicleSelection,
    toNumber,
    travelLookupMessage,
    updateCustomMaterial,
    updateEstimateLaborEmployee,
  } = workspace;

  return (
    <div className="appShell">
      <style>{css}</style>

      {renderEstimatorShellHeader({
        title: "TPO Estimate",
        intro: "Build the estimate in the same order the job is scoped, priced, and bid.",
      })}

      {renderQuickMeasureReviewPanel()}

      <Section title="Estimate Snapshot" subtitle="Track bid status while you complete scope and pricing.">
        <div className="summaryGrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <div className="summaryCard">
            <span>Next estimate</span>
            <strong>{estimateCode(nextEstimateNumber)}</strong>
            <p>Assigned on save</p>
          </div>
          <div className="summaryCard">
            <span>Total squares</span>
            <strong>{num(calculation.scope.totalSquares, 0)}</strong>
            <p>Used for per-square calculations</p>
          </div>
          <div className="summaryCard">
            <span>Current bid</span>
            <strong>{money(calculation.selectedBidAmount)}</strong>
            <p>{num(calculation.selectedMarkupPercent, 0)}% markup</p>
            <div className={`statusPill ${isEstimateComplete ? "" : "bad"}`}>{estimateStatusLabel}</div>
          </div>
        </div>
      </Section>

      <Section title="Job Information" subtitle="Start here so the job record stays aligned with travel and saved estimates.">
        <div className="formGrid">
          <Field label="Job name">
            <input
              type="text"
              value={inputs.jobName}
              onChange={(e) => setField("jobName", e.target.value)}
              placeholder="Job name"
            />
          </Field>
          <Field label="Customer name">
            <input
              type="text"
              value={inputs.customerName}
              onChange={(e) => setField("customerName", e.target.value)}
              placeholder="Customer name"
            />
          </Field>
          <Field label="Job address">
            <div style={{ display: "grid", gap: 8 }}>
              <input
                type="text"
                value={inputs.jobAddress}
                onChange={(e) => setField("jobAddress", e.target.value)}
                placeholder="Job address"
              />
              <button type="button" className="secondaryButton" onClick={handleCalculateDistance}>
                Search travel distance
              </button>
            </div>
          </Field>
        </div>
      </Section>

      <Section title="TPO scope flow" subtitle="Answer the scope questions in order.">
        <div className="formStack">
          <div className="inputSection">
            <h3>1. Is this job:</h3>
            <div className="choiceRow">
              {JOB_TYPE_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  name="jobType"
                  value={option.value}
                  label={option.label}
                  checked={inputs.jobType === option.value}
                  onChange={(e) =>
                    setInputs((current) => ({
                      ...current,
                      jobType: e.target.value,
                      existingRoofAction: e.target.value === "existingRoof" ? current.existingRoofAction : "",
                      substrateType: e.target.value === "newConstruction" ? current.substrateType : "",
                    }))
                  }
                />
              ))}
            </div>
          </div>

          {inputs.jobType === "existingRoof" ? (
            <div className="inputSection">
              <h3>2. Are we:</h3>
              <div className="choiceRow">
                {EXISTING_ROOF_OPTIONS.map((option) => (
                  <ChoiceCard
                    key={option.value}
                    name="existingRoofAction"
                    value={option.value}
                    label={option.label}
                    checked={inputs.existingRoofAction === option.value}
                    onChange={(e) =>
                      setInputs((current) => ({
                        ...current,
                        existingRoofAction: e.target.value,
                      }))
                    }
                  />
                ))}
              </div>

              {inputs.existingRoofAction === "tearOff" ? (
                <div className="formGrid">
                  <Field label="How many existing roof layers?">
                    <input
                      type="number" onWheel={handleNumberInputWheel}
                      min="1"
                      step="1"
                      value={inputs.tearOffLayers}
                      onChange={(e) => setField("tearOffLayers", e.target.value)}
                    />
                  </Field>
                  <Field label="Is this tear-off a double handle job?">
                    <select
                      value={inputs.isDoubleHandleTearOff ? "yes" : "no"}
                      onChange={(e) => setField("isDoubleHandleTearOff", e.target.value === "yes")}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </Field>
                </div>
              ) : null}
            </div>
          ) : null}

          {inputs.jobType === "newConstruction" ? (
            <div className="inputSection">
              <h3>2. What substrate/system is required?</h3>
              <div className="choiceRow">
                {SUBSTRATE_OPTIONS.map((option) => (
                  <ChoiceCard
                    key={option.value}
                    name="substrateType"
                    value={option.value}
                    label={option.label}
                    checked={inputs.substrateType === option.value}
                    onChange={(e) =>
                      setInputs((current) => ({
                        ...current,
                        substrateType: e.target.value,
                      }))
                    }
                  />
                ))}
              </div>

              {inputs.substrateType === "rigidInsulation" ? (
                <Field label="What R-value is requested?">
                  <select value={inputs.requestedRValue} onChange={(e) => setField("requestedRValue", e.target.value)}>
                    {R_VALUE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        R-{value}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>
      </Section>

      <Section title="TPO termination" subtitle="Choose the parapet or edge termination method first.">
        <div className="formStack">
          <div className="inputSection">
            <h3>How will the TPO terminate at parapet or roof edges?</h3>
            <div className="choiceRow">
              {TERMINATION_METHOD_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  name="terminationMethod"
                  value={option.value}
                  label={option.label}
                  checked={inputs.terminationMethod === option.value}
                  onChange={(e) =>
                    setInputs((current) => ({
                      ...current,
                      terminationMethod: e.target.value,
                    }))
                  }
                  />
              ))}
              <ChoiceCard
                key="multiTermination"
                name="terminationMethod"
                value="multiTermination"
                label="Two or more different types of terminations"
                checked={inputs.terminationMethod === "multiTermination"}
                onChange={() =>
                  setInputs((current) => ({
                    ...current,
                    terminationMethod: "multiTermination",
                    multiTerminationRows:
                      current.multiTerminationRows && current.multiTerminationRows.length > 0
                        ? current.multiTerminationRows
                        : [createBlankTerminationRow()],
                  }))
                }
              />
            </div>

            {inputs.terminationMethod === "multiTermination" ? (
              <div className="inputSection" style={{ marginTop: 14 }}>
                <h3>Termination methods breakdown</h3>
                {(inputs.multiTerminationRows || []).map((row, idx) => {
                  const rowType = row.terminationType || row.type || "";
                  return (
                    <div key={row.id || idx} className="formGrid" style={{ alignItems: "end" }}>
                      <Field label="Termination type">
                        <select
                          value={rowType}
                          onChange={(e) =>
                            setInputs((current) => {
                              const next = [...(current.multiTerminationRows || [])];
                              next[idx] = {
                                ...next[idx],
                                terminationType: e.target.value,
                                type: e.target.value,
                              };
                              return { ...current, multiTerminationRows: next };
                            })
                          }
                        >
                          <option value="">Select type</option>
                          {TERMINATION_METHOD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Linear feet">
                        <input
                          type="number" onWheel={handleNumberInputWheel}
                          min="0"
                          step="1"
                          value={row.linearFeet}
                          onChange={(e) =>
                            setInputs((current) => {
                              const next = [...(current.multiTerminationRows || [])];
                              next[idx] = {
                                ...next[idx],
                                linearFeet: e.target.value,
                              };
                              return { ...current, multiTerminationRows: next };
                            })
                          }
                        />
                      </Field>
                      {inputs.multiTerminationRows.length > 1 ? (
                        <div className="actionRow">
                          <button
                            type="button"
                            className="dangerButton"
                            onClick={() =>
                              setInputs((current) => ({
                                ...current,
                                multiTerminationRows: current.multiTerminationRows.filter((_, i) => i !== idx),
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <div className="actionRow" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={() =>
                      setInputs((current) => ({
                        ...current,
                        multiTerminationRows: [...(current.multiTerminationRows || []), createBlankTerminationRow()],
                      }))
                    }
                  >
                    Next termination method
                  </button>
                </div>
              </div>
            ) : null}

            {inputs.terminationMethod === "copingMetal" ? (
              <div className="formGrid">
                <Field label="Coping linear feet">
                  <input
                    type="number" onWheel={handleNumberInputWheel}
                    min="0"
                    step="1"
                    value={inputs.copingLinearFeet}
                    onChange={(e) => setField("copingLinearFeet", e.target.value)}
                  />
                </Field>
                <Field label="Is cleat required?">
                  <select
                    value={inputs.copingCleatRequired ? "yes" : "no"}
                    onChange={(e) => setField("copingCleatRequired", e.target.value === "yes")}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              </div>
            ) : null}

            {inputs.terminationMethod === "cladDripEdge" ? (
              <Field label="Drip edge linear feet">
                <input
                  type="number" onWheel={handleNumberInputWheel}
                  min="0"
                  step="1"
                  value={inputs.dripEdgeLinearFeet}
                  onChange={(e) => setField("dripEdgeLinearFeet", e.target.value)}
                />
              </Field>
            ) : null}

            {inputs.terminationMethod === "termBar" ? (
              <Field label="Term bar linear feet">
                <input
                  type="number" onWheel={handleNumberInputWheel}
                  min="0"
                  step="1"
                  value={inputs.termBarLinearFeet}
                  onChange={(e) => setField("termBarLinearFeet", e.target.value)}
                />
              </Field>
            ) : null}

            {inputs.terminationMethod === "existingMetal" ? (
              <Field label="Strip-in / detail allowance">
                <input
                  type="number" onWheel={handleNumberInputWheel}
                  min="0"
                  step="0.01"
                  value={inputs.stripInDetailAllowanceCost}
                  onChange={(e) => setField("stripInDetailAllowanceCost", e.target.value)}
                />
              </Field>
            ) : null}

            {inputs.terminationMethod === "otherManual" ? (
              <div className="formGrid">
                <Field label="Notes">
                  <textarea
                    rows="4"
                    value={inputs.terminationNotes}
                    onChange={(e) => setField("terminationNotes", e.target.value)}
                  />
                </Field>
                <Field label="Manual cost">
                  <input
                    type="number" onWheel={handleNumberInputWheel}
                    min="0"
                    step="0.01"
                    value={inputs.manualTerminationCost}
                    onChange={(e) => setField("manualTerminationCost", e.target.value)}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title="Roof Measurements" subtitle="Capture the roof field and parapet dimensions before detail pricing.">
        <div className="formGrid">
          <Field label="Total roof field SQs (no parapet wall measurements)">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={inputs.fieldSquares}
              onChange={(e) => setField("fieldSquares", e.target.value)}
            />
          </Field>
          <Field label="Total perimeter linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={inputs.roofPerimeterLf}
              onChange={(e) => setField("roofPerimeterLf", e.target.value)}
            />
          </Field>
          <Field label="Total parapet wall linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={inputs.parapetLinearFeet}
              onChange={(e) => setField("parapetLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Total parapet wall average height">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={inputs.parapetWallHeight}
              onChange={(e) => setField("parapetWallHeight", e.target.value)}
            />
          </Field>
          <Field label="Include parapet walls in the material takeoff?">
            <select
              value={inputs.includeParapetWalls ? "yes" : "no"}
              onChange={(e) => setField("includeParapetWalls", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow
            label="Total parapet square feet"
            value={num(calculation.scope.parapetLinearFeet * calculation.scope.parapetWallHeight, 0)}
          />
        </div>
      </Section>

      <Section title="Material calculators" subtitle="These quantities are calculated from the scope and detail inputs.">
        <div className="formGrid">
          <Field label="Roof jacks">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.roofJacks} onChange={(e) => setField("roofJacks", e.target.value)} />
          </Field>
          <Field label="Vents / T-tops">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.ventsTtops} onChange={(e) => setField("ventsTtops", e.target.value)} />
          </Field>
          <Field label="Large penetrations around 2 ft">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={inputs.largePenetrations2ft}
              onChange={(e) => setField("largePenetrations2ft", e.target.value)}
            />
          </Field>
          <Field label="Very large penetrations around 4 ft">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={inputs.veryLargePenetrations4ft}
              onChange={(e) => setField("veryLargePenetrations4ft", e.target.value)}
            />
          </Field>
          <Field label="Drains">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.detailDrains} onChange={(e) => setField("detailDrains", e.target.value)} />
          </Field>
          <Field label="Scuppers">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.detailScuppers} onChange={(e) => setField("detailScuppers", e.target.value)} />
          </Field>
          <Field label="Pitch pockets">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.detailPitchPockets} onChange={(e) => setField("detailPitchPockets", e.target.value)} />
          </Field>
          <Field label="A/C detail units">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.detailAcUnits} onChange={(e) => setField("detailAcUnits", e.target.value)} />
          </Field>
          <Field label="A/C detail type">
            <select value={inputs.acDetailType} onChange={(e) => setField("acDetailType", e.target.value)}>
              {AC_DETAIL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Misc irregular details">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={inputs.miscIrregularDetails}
              onChange={(e) => setField("miscIrregularDetails", e.target.value)}
            />
          </Field>
          <Field label="Pitch pockets">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.pitchPockets} onChange={(e) => setField("pitchPockets", e.target.value)} />
          </Field>
          <Field label="T-joint patches">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tJointPatches} onChange={(e) => setField("tJointPatches", e.target.value)} />
          </Field>
          <Field label="Vent boots">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.ventBoots} onChange={(e) => setField("ventBoots", e.target.value)} />
          </Field>
          <Field label="Manual pitch pocket total cost">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.01"
              value={inputs.manualPitchPocketTotalCost}
              onChange={(e) => setField("manualPitchPocketTotalCost", e.target.value)}
            />
          </Field>
          <Field label="Manual detail membrane rolls override">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={inputs.manualDetailMembraneRolls}
              onChange={(e) => setField("manualDetailMembraneRolls", e.target.value)}
            />
          </Field>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="5ft TPO perimeter rolls" value={num(calculation.scope.starterRolls, 0)} />
          <DetailRow label="10ft field rolls" value={num(calculation.scope.fieldRolls, 0)} />
          <DetailRow label="Parapet rolls" value={num(calculation.scope.parapetRolls, 0)} />
          <DetailRow label="Fanfold bundles" value={num(calculation.scope.fanfoldBundles, 0)} />
          <DetailRow label="Dense deck sheets" value={num(calculation.scope.denseDeckSheets, 0)} />
          <DetailRow label="Rigid insulation sheets" value={num(calculation.scope.rigidInsulationTotalSheets, 0)} />
          <DetailRow label="Parapet adhesive tanks" value={num(calculation.scope.parapetAdhesiveTanks, 0)} />
          <DetailRow label="Pitch pocket detail membrane sqft" value={num(calculation.pitchPocket.pitchPocketDetailMembraneSqft, 0)} />
          <DetailRow label="Detail membrane sqft" value={num(calculation.detailMembrane.totalDetailMembraneSqft, 0)} />
          <DetailRow label="Detail membrane rolls" value={num(calculation.detailMembrane.rollsNeeded, 0)} />
          <DetailRow label="Pitch pocket cost" value={money(calculation.pitchPocket.totalPitchPocketCost)} />
        </div>
      </Section>

      <Section title="A/C handling" subtitle="Count the units before you calculate the roof labor.">
        <div className="formGrid">
          <Field label="Total A/C units on roof">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.totalAcUnits} onChange={(e) => setField("totalAcUnits", e.target.value)} />
          </Field>
          <Field label="Units jacked / raised in place">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.jackedUnits} onChange={(e) => setField("jackedUnits", e.target.value)} />
          </Field>
          <Field label="Units worked around">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.workedAroundUnits} onChange={(e) => setField("workedAroundUnits", e.target.value)} />
          </Field>
          <Field label="Units craned / lifted off roof">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.cranedUnits} onChange={(e) => setField("cranedUnits", e.target.value)} />
          </Field>
          <Field label="Units requiring disconnect / reconnect">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={inputs.acDisconnectReconnectUnits}
              onChange={(e) => setField("acDisconnectReconnectUnits", e.target.value)}
            />
          </Field>
          <Field label="Is crane needed?">
            <select
              value={inputs.isCraneNeeded ? "yes" : "no"}
              onChange={(e) => setField("isCraneNeeded", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Total crane hours onsite">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.totalCraneHours} onChange={(e) => setField("totalCraneHours", e.target.value)} />
          </Field>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="A/C units raised cost" value={money(calculation.acHandling.acRaiseCost)} />
          <DetailRow label="A/C worked-around labor allowance" value={money(calculation.acHandling.acWorkedAroundLaborCost)} />
          <DetailRow label="Disconnect / reconnect cost" value={money(calculation.acHandling.acDisconnectReconnectCost)} />
          <DetailRow label="Crane base cost" value={money(calculation.acHandling.craneBaseCost)} />
          <DetailRow label="Extra crane hours" value={num(calculation.acHandling.extraCraneHours, 1)} />
          <DetailRow label="Total crane cost" value={money(calculation.acHandling.craneCost)} />
          <DetailRow label="Total A/C handling cost" value={money(calculation.acHandling.totalAcHandlingCost)} />
          <DetailRow label="A/C counts" value={calculation.acHandling.warning || "Counts match"} />
        </div>
      </Section>

      <Section title="Labor" subtitle="Choose who performs the labor and let the app calculate the labor cost.">
        <div className="inputSection">
          <h3>1. Who is doing the labor?</h3>
          <div className="choiceRow">
            {LABOR_TYPE_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                name="laborType"
                value={option.value}
                label={option.label}
                checked={inputs.laborType === option.value}
                onChange={(e) =>
                  setInputs((current) => ({
                    ...current,
                    laborType: e.target.value,
                    subcontractorLicenseStatus: e.target.value === "subcontractor" ? current.subcontractorLicenseStatus : "",
                  }))
                }
              />
            ))}
          </div>

          {inputs.laborType === "subcontractor" ? (
            <div className="formGrid" style={{ marginTop: 12 }}>
              <Field label="Is the subcontractor licensed?">
                <select value={inputs.subcontractorLicenseStatus} onChange={(e) => setField("subcontractorLicenseStatus", e.target.value)}>
                  <option value="">Choose one</option>
                  {LICENSE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Labor rate per SQ">
                <input
                  type="number" onWheel={handleNumberInputWheel}
                  min="0"
                  step="0.01"
                  value={inputs.subcontractorLaborRatePerSq}
                  onChange={(e) => setField("subcontractorLaborRatePerSq", e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {inputs.laborType === "subcontractor" ? (
            <div className="inputSection" style={{ marginTop: 12 }}>
              <h3>2. Is the sub-contractor charging extras for add-ons?</h3>
              <Field label="Extras for add-ons?">
                <select
                  value={inputs.subcontractorHasAddOns ? "yes" : "no"}
                  onChange={(e) => setField("subcontractorHasAddOns", e.target.value === "yes")}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>

              {inputs.subcontractorHasAddOns ? (
                <div style={{ marginTop: 12 }}>
                  <div className="actionRow" style={{ marginBottom: 12 }}>
                    <button type="button" className="secondaryButton" onClick={handleAddSubcontractorLineItem}>
                      Want to include extra line items?
                    </button>
                  </div>

                  <div className="tableWrap">
                    <table className="dataTable">
                      <thead>
                        <tr>
                          <th>Add-on</th>
                          <th>Qty</th>
                          <th>Unit price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculation.labor.subcontractorAddOnItems.map((item, index) => {
                          const total = item.quantity * item.unitPrice;
                          return (
                            <tr key={`${item.description || "add-on"}-${index}`}>
                              <td>
                                <input
                                  className="tableInput"
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => setSubcontractorAddOnItem(index, "description", e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  className="tableInput"
                                  type="number" onWheel={handleNumberInputWheel}
                                  min="0"
                                  step="1"
                                  value={item.quantity}
                                  onChange={(e) => setSubcontractorAddOnItem(index, "quantity", e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  className="tableInput"
                                  type="number" onWheel={handleNumberInputWheel}
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => setSubcontractorAddOnItem(index, "unitPrice", e.target.value)}
                                />
                              </td>
                              <td>{money(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {inputs.laborType === "inHouse" ? (
            <div className="estimateLaborCrew" style={{ marginTop: 12 }}>
              <div className="summaryGrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 0 }}>
                <div className="summaryCard">
                  <span>Workers’ compensation</span>
                  <strong>{num(WORKERS_COMP_RATE * 100, 1)}%</strong>
                  <p>Calculated from base employee wages.</p>
                </div>
                <div className="summaryCard">
                  <span>Payroll tax</span>
                  <strong>{num(PAYROLL_TAX_RATE * 100, 1)}%</strong>
                  <p>Calculated separately from base wages.</p>
                </div>
                <div className="summaryCard">
                  <span>Total labor burden</span>
                  <strong>{num(TOTAL_LABOR_BURDEN_RATE * 100, 1)}%</strong>
                  <p>Loaded wage equals 159.25% of base wage.</p>
                </div>
              </div>

              <div className="actionRow">
                <button type="button" className="secondaryButton" onClick={addEstimateLaborEmployee}>+ Add employee to estimate</button>
                {canManageEmployeeWages ? <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("administration")}>Manage employees and wages</button> : null}
              </div>

              {normalizeEstimateLaborEmployeeRows(inputs.laborEmployeeRows).length ? (
                <div className="savedList">
                  {normalizeEstimateLaborEmployeeRows(inputs.laborEmployeeRows).map((row) => {
                    const loadedWage = calculateLoadedHourlyWage(row.hourlyRate);
                    return (
                      <div className="savedCard" key={row.id}>
                        <div className="formGrid">
                          <Field label="Employee">
                            <select value={row.employeeId} onChange={(e) => updateEstimateLaborEmployee(row.id, "employeeId", e.target.value)}>
                              <option value="">Select employee</option>
                              {employeeDirectory.filter((employee) => employee.isActive).map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                  {employee.displayName || buildEmployeeDisplayName(employee)} · {money2(employee.hourlyRate || 0)}/hr
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Base hourly wage">
                            <input type="number" value={row.hourlyRate} disabled />
                          </Field>
                          <Field label="Estimated hours">
                            <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.5" value={row.estimatedHours} onChange={(e) => updateEstimateLaborEmployee(row.id, "estimatedHours", e.target.value)} />
                          </Field>
                          <Field label="Loaded hourly cost">
                            <input type="text" value={money2(loadedWage.loadedHourlyCost)} disabled />
                          </Field>
                        </div>
                        <div className="actionRow">
                          <button type="button" className="dangerButton" onClick={() => removeEstimateLaborEmployee(row.id)}>Remove employee</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="emptyState">No employees selected. Add employees above, or use the manual crew fallback below.</p>
              )}

              <div className="inputSection">
                <h3>Manual crew fallback</h3>
                <p className="smallNote">Used only when no saved employees are selected.</p>
                <div className="formGrid">
                  <Field label="Number of workers">
                    <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.laborWorkers} onChange={(e) => setField("laborWorkers", e.target.value)} />
                  </Field>
                  <Field label="Average hourly wage">
                    <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={inputs.laborHourlyRate} onChange={(e) => setField("laborHourlyRate", e.target.value)} />
                  </Field>
                  <Field label="Estimated hours per worker">
                    <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.laborHoursPerWorker} onChange={(e) => setField("laborHoursPerWorker", e.target.value)} />
                  </Field>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Labor type" value={calculation.labor.laborType || "Not selected"} />
          {calculation.labor.laborType === "subcontractor" ? (
            <>
              <DetailRow label="Subcontractor licensed/unlicensed" value={calculation.labor.subcontractorLicenseStatus || "Not selected"} />
              <DetailRow label="Labor rate per SQ" value={money2(calculation.labor.subcontractorLaborRatePerSq)} />
              <DetailRow label="Base labor cost" value={money(calculation.labor.subLaborBase)} />
              {calculation.labor.workersCompCost > 0 ? <DetailRow label="Workers comp cost" value={money(calculation.labor.workersCompCost)} /> : null}
            </>
          ) : null}
          {calculation.labor.laborType === "inHouse" ? (
            <>
              <DetailRow label="Workers" value={num(calculation.labor.workers, 0)} />
              <DetailRow label="Wage source" value={calculation.labor.usesEmployeeWages ? "Selected employee wages" : "Manual crew average"} />
              <DetailRow label="Base payroll" value={money(calculation.labor.basePayroll)} />
              <DetailRow label="Workers’ compensation (50%)" value={money(calculation.labor.workersCompCost)} />
              <DetailRow label="Payroll tax (9.25%)" value={money(calculation.labor.payrollTaxCost)} />
              <DetailRow label="Total labor burden (59.25%)" value={money(calculation.labor.payrollBurden)} />
            </>
          ) : null}
          <DetailRow label="Total labor cost" value={money(calculation.labor.totalLaborCost)} />
          {calculation.labor.laborType === "subcontractor" && calculation.labor.subcontractorHasAddOns ? (
            <DetailRow label="Subcontractor add-on extras" value={money(calculation.labor.subcontractorAddOnTotal)} />
          ) : null}
        </div>
      </Section>

      <TravelCalculator
        inputs={inputs}
        calculation={calculation}
        isLoaded={isLoaded}
        loadError={loadError}
        isLookingUpDistance={isLookingUpDistance}
        travelLookupMessage={travelLookupMessage}
        googleDebug={googleDebug}
        showGoogleDebug={Boolean(typeof import.meta !== "undefined" && import.meta.env?.DEV)}
        oneWayMilesLabel="Miles to location"
        onJobSiteAddressChange={(value) => {
          setTravelField("jobSiteAddress", value);
          setField("jobAddress", value);
        }}
        onOneWayMilesChange={(value) => setTravelField("oneWayMiles", value)}
        onAverageDrivingSpeedChange={(value) => setTravelField("averageDrivingSpeedMph", value)}
        onWorkHoursPerDayChange={(value) => setTravelField("workHoursPerDay", value)}
        onNumberOfJobDaysChange={(value) => setTravelField("numberOfJobDays", value)}
        onNumberOfDriversChange={(value) => setTravelField("numberOfDrivers", value)}
        onVehicleSelection={setTravelVehicleSelection}
        onAddVehicleSelection={addTravelVehicleSelection}
        onRemoveVehicleSelection={removeTravelVehicleSelection}
        onCalculateDistance={handleCalculateDistance}
      />

      <Section title="Overhead" subtitle="Apply overhead before markup is calculated.">
        <div className="summaryGrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 0 }}>
          <div className="summaryCard">
            <span>Direct job cost</span>
            <strong>{money(calculation.directJobCost || 0)}</strong>
          </div>
          <div className="summaryCard">
            <span>Overhead markup</span>
            <strong>{money(calculation.overheadCost || 0)}</strong>
          </div>
          <div className="summaryCard">
            <span>Operating markup</span>
            <strong>{money(calculation.operatingCost || 0)}</strong>
          </div>
          <div className="summaryCard">
            <span>Total before profit</span>
            <strong>{money(calculation.totalCostBeforeProfit || 0)}</strong>
          </div>
        </div>
        <div className="formGrid">
          <Field label="Overhead / operating rate">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={inputs.overheadPercent ?? 17.5}
              onChange={(e) => setField("overheadPercent", e.target.value)}
            />
          </Field>
          <Field label="Scope adders">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.01"
              value={inputs.scopeAdders || 0}
              onChange={(e) => setField("scopeAdders", e.target.value)}
            />
          </Field>
          <Field label="Misc cost">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.01"
              value={inputs.miscCost || 0}
              onChange={(e) => setField("miscCost", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <SafeTileSection>
        <Section title="Bid options" subtitle="These are markup percentages, not gross margin percentages.">
          <div className="bidGrid">
            {calculation.bidOptions.options.map((option) => (
              <button
                key={option.percent}
                type="button"
                className={`bidCard ${option.percent === calculation.selectedMarkupPercent ? "active" : ""}`}
                onClick={() => handleSelectedMarkup(option.percent)}
              >
                <span className="bidCardTitle">{option.percent}% Markup</span>
                <strong>Bid: {money(option.bidAmount)}</strong>
                <span>$/SQ: {money2(option.pricePerSq)}</span>
                <span>Profit: {money(option.profitDollars)}</span>
              </button>
            ))}
          </div>

          <h3 style={{ margin: "18px 0 10px", color: "var(--text-main)", fontSize: "1.05rem", letterSpacing: "0.02em" }}>
            Custom Bid Amount
          </h3>
          <div className="summaryCard">
            <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>
              Custom Bid Amount
            </span>
            <label style={{ display: "block", marginBottom: 8, color: "var(--text-muted)", fontSize: "0.95rem" }}>
              Custom Bid Amount
            </label>
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.01"
              value={inputs.sprayFoamCustomBidAmount}
              onChange={(e) => {
                setField("sprayFoamCustomBidAmount", e.target.value);
                setField("sprayFoamCustomBidSelected", Number(e.target.value || 0) > 0);
              }}
            />
            <div className="detailList" style={{ marginTop: 12 }}>
              <DetailRow label="Custom Profit" value={money(calculation.customProfitDollars)} />
              <DetailRow label="Custom Price Per Square" value={money2(calculation.customPricePerSq)} />
            </div>
          </div>

          <div className="detailList" style={{ marginTop: 14 }}>
            <DetailRow label="Selected markup" value={calculation.customBidSelected ? "Custom Bid" : `${num(calculation.selectedMarkupPercent, 0)}%`} />
            <DetailRow
              label={calculation.customBidSelected ? "Custom bid amount" : "Selected bid amount"}
              value={money(calculation.selectedBidAmount)}
            />
            <DetailRow
              label={calculation.customBidSelected ? "Custom price per SQ" : "Selected price per SQ"}
              value={money2(calculation.selectedPricePerSq)}
            />
            <DetailRow
              label={calculation.customBidSelected ? "Custom profit" : "Selected profit dollars"}
              value={money(calculation.selectedProfitDollars)}
            />
          </div>

          <div className="actionRow" style={{ marginTop: 16 }}>
            <button type="button" className="primaryButton" onClick={handleDownloadEstimatePDF}>
              Download Estimate PDF
            </button>
          </div>
        </Section>

        <Section title="Saved estimates" subtitle="Load or delete anything you saved in Supabase.">
          <div className="savedList">
            {activeSavedEstimates.length ? (
              activeSavedEstimates.map((estimate) => (
                <div className="savedCard" key={estimate.id}>
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <span className="eyebrow">{estimate.estimateCode || estimateCode(estimate.estimateNumber || 1)}</span>
                      <span className={`statusTag statusTag-${(estimate.status || "draft").toLowerCase()}`}>
                        {String(estimate.status || "draft").toUpperCase()}
                      </span>
                    </div>
                    <strong>{estimate.name || "Untitled estimate"}</strong>
                    <p>
                      {estimate.estimateType ? `${estimate.estimateType} | ` : ""}
                      {estimate.inputs?.jobName ? `${estimate.inputs.jobName} | ` : ""}
                      {estimate.inputs?.customerName ? `${estimate.inputs.customerName} | ` : ""}
                      {num(estimate.summary?.totalSquares ?? estimate.inputs?.totalSquares ?? 0, 0)} SQ |{" "}
                      {money(estimate.summary?.selectedBidAmount ?? 0)} bid |{" "}
                      {num(estimate.summary?.selectedMarkupPercent ?? 0, 0)}% markup
                    </p>
                    {isAdminUser ? (
                      <p>Owner: {estimate.ownerDisplayName || estimate.ownerEmail || estimate.ownerId || "Unassigned"}</p>
                    ) : null}
                  </div>

                  <div className="savedActions">
                    <button type="button" className="secondaryButton" onClick={() => handleConvertEstimateToProposal(estimate)}>
                      Generate Proposal
                    </button>
                    <button type="button" className="secondaryButton" onClick={() => handleLoadEstimate(estimate)}>
                      Load
                    </button>
                    <button type="button" className="secondaryButton" onClick={() => handleApproveJob(estimate)}>
                      Approve Job
                    </button>
                    <button type="button" className="secondaryButton" onClick={() => handleCompleteJob(estimate)}>
                      Complete Job
                    </button>
                    {isAdminUser ? (
                      <>
                        <select
                          value={estimateOwnerAssignments[estimate.id] || estimate.ownerId || ""}
                          onChange={(e) => handleEstimateOwnerSelection(estimate.id, e.target.value)}
                        >
                          <option value="">Select owner</option>
                          {companyUserProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {(profile.full_name || profile.email || profile.id)} ({normalizeAppRole(profile.role)})
                            </option>
                          ))}
                        </select>
                        <button type="button" className="secondaryButton" onClick={() => handleReassignEstimateOwner(estimate)}>
                          Reassign
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="dangerButton" onClick={() => handleDeleteEstimate(estimate)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="emptyState">No saved estimates yet.</p>
            )}
          </div>
        </Section>

        <Section title="Completed jobs" subtitle="Track jobs marked completed in Supabase.">
          <div className="savedList">
            {completedJobs.length ? (
              completedJobs.map((job) => (
                <div className="savedCard" key={job.id}>
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <span className="eyebrow">{job.estimateCode || "Completed Job"}</span>
                      <span className={`statusTag statusTag-${(job.status || "completed").toLowerCase()}`}>
                        {String(job.status || "completed").toUpperCase()}
                      </span>
                    </div>
                    <strong>{job.customerName || "Unknown customer"}</strong>
                    <p>
                      {job.jobAddress ? `${job.jobAddress} | ` : ""}
                      {job.roofType ? `${job.roofType} | ` : ""}
                      {num(job.squareCount ?? 0, 0)} SQ | {money(job.finalBid ?? 0)} bid
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="emptyState">No completed jobs yet.</p>
            )}
          </div>
        </Section>

      <Section title="Material pricing" subtitle="Edit the unit prices. Leave anything at zero if you want to price it manually later.">
        <div className="formGrid">
          {priceFields.map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="0.01"
                value={prices[key]}
                onChange={(e) => setPriceField(key, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="actionRow">
            <button type="button" className="secondaryButton" onClick={addCustomMaterial}>
              Add material
            </button>
            <em style={{ marginLeft: 8 }}>Custom materials saved with estimate</em>
          </div>

          {Array.isArray(inputs.customMaterials) && inputs.customMaterials.length ? (
            <div className="tableWrap" style={{ marginTop: 12 }}>
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Unit price</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {inputs.customMaterials.map((mat, idx) => (
                    <tr key={mat.id || idx}>
                      <td>
                        <input type="text" value={mat.name} onChange={(e) => updateCustomMaterial(idx, "name", e.target.value)} />
                      </td>
                      <td>
                        <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={mat.quantity} onChange={(e) => updateCustomMaterial(idx, "quantity", e.target.value)} />
                      </td>
                      <td>
                        <input type="text" value={mat.unit} onChange={(e) => updateCustomMaterial(idx, "unit", e.target.value)} />
                      </td>
                      <td>
                        <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={mat.unitPrice} onChange={(e) => updateCustomMaterial(idx, "unitPrice", e.target.value)} />
                      </td>
                      <td>{money((toNumber(mat.quantity, 0) * toNumber(mat.unitPrice, 0)) || 0)}</td>
                      <td>
                        <button type="button" className="dangerButton" onClick={() => deleteCustomMaterial(idx)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </Section>

      <Section title="Calculated outputs" subtitle="These totals update automatically as you work through the estimate.">
        <div className="summaryGrid">
          <div className="summaryCard">
            <span>Material pricing</span>
            <strong>{money(calculation.materialCost)}</strong>
          </div>
          <div className="summaryCard">
            <span>Labor cost</span>
            <strong>{money(calculation.laborCost)}</strong>
          </div>
          <div className="summaryCard">
            <span>Travel &amp; Overtime cost</span>
            <strong>{money(calculation.totalTravelCost)}</strong>
          </div>
          <div className="summaryCard">
            <span>Overhead</span>
            <strong>{money(calculation.overheadOperatingCost)}</strong>
          </div>
          <div className="summaryCard">
            <span>Total cost</span>
            <strong>{money(calculation.totalCost)}</strong>
          </div>
        </div>

        <div className="detailList">
          <DetailRow label="Material cost" value={money(calculation.materialCost)} />
          <DetailRow label="Labor cost" value={money(calculation.laborCost)} />
          <DetailRow label="Tear-off cost" value={money(calculation.scope.totalTearOffCost)} />
          <DetailRow label="A/C handling cost" value={money(calculation.acHandlingCost)} />
          <DetailRow label="Travel & Overtime cost" value={money(calculation.totalTravelCost)} />
          <DetailRow label="Direct job cost" value={money(calculation.directJobCost)} />
          <DetailRow label="Overhead / operating rate" value={`${num(calculation.overheadOperatingRate * 100, 1)}%`} />
          <DetailRow label="Overhead cost" value={money(calculation.overheadOperatingCost)} />
          <DetailRow label="Total cost before profit" value={money(calculation.totalCostBeforeProfit)} />
          <DetailRow label="Total squares" value={num(calculation.scope.totalSquares, 0)} />
          <DetailRow label="Termination cost" value={money(calculation.terminationCost)} />
          <DetailRow label="Pitch pocket cost" value={money(calculation.pitchPocketCost)} />
        </div>
      </Section>

      <Section title="Material Cost Breakdown" subtitle="Each quantity comes from the TPO logic and each unit price is editable.">
        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Material</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Unit price</th>
                <th>Total cost</th>
              </tr>
            </thead>
            <tbody>
              {calculation.materialPricing.items.map((item) => (
                <tr key={item.key}>
                  <td>
                    <div>
                      <strong>{item.label}</strong>
                      {item.notes ? <div className="smallNote">{item.notes}</div> : null}
                    </div>
                  </td>
                  <td>{num(item.quantity, 0)}</td>
                  <td>{item.unit}</td>
                  <td>{money2(item.unitPrice)}</td>
                  <td>{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Detail membrane sqft" value={num(calculation.detailMembrane.totalDetailMembraneSqft, 0)} />
          <DetailRow label="Detail membrane rolls" value={num(calculation.detailMembrane.rollsNeeded, 0)} />
          <DetailRow label="Detail membrane cost" value={money(calculation.detailMembrane.detailMembraneCost)} />
          <DetailRow label="Pitch pocket total cost" value={money(calculation.pitchPocket.totalPitchPocketCost)} />
          <DetailRow label="Material cost per square" value={money2(calculation.materialPricing.costPerSquare)} />
        </div>
      </Section>

      <Section
        title="Save Estimate"
        subtitle="Save and load estimates through Supabase for cross-device persistence."
        right={
          <div className="actionRow">
            <button type="button" className="primaryButton" onClick={handleSaveEstimate}>
              Save estimate
            </button>
            <button type="button" className="secondaryButton" onClick={handleConvertCurrentEstimateToProposal}>
              Generate Proposal
            </button>
            <button type="button" className="secondaryButton" onClick={handleLogout}>
              Log out
            </button>
          </div>
        }
      >
        <div className="formGrid">
          <Field label="Estimate name">
            <input
              type="text"
              value={estimateName}
              onChange={(e) => setEstimateName(e.target.value)}
              placeholder={buildEstimateName(inputs)}
            />
          </Field>

          <Field label="Estimate status">
            <select
              value={inputs.estimateStatus || "draft"}
              onChange={(e) => setField("estimateStatus", e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
            </select>
          </Field>

          <div className="summaryCard">
            <span>Estimate status</span>
            <strong>{estimateStatusLabel}</strong>
            <p>{isEstimateComplete ? "Required scope values are filled in." : "Review the checklist before final bid."}</p>
          </div>

          <div className="summaryCard">
            <span>Selected bid</span>
            <strong>{money(calculation.selectedBidAmount)}</strong>
            <p>
              {num(calculation.selectedMarkupPercent, 0)}% markup and {money2(calculation.selectedPricePerSq)} per SQ.
            </p>
          </div>
        </div>

        <div className="actionRow" style={{ marginTop: 16 }}>
          <button type="button" className="primaryButton" onClick={handleDownloadEstimatePDF}>
            Download Estimate PDF
          </button>
        </div>

        {sessionMessage ? (
          <p className={`statusMessage ${sessionMessageType === "error" ? "dangerMessage" : ""}`}>
            {sessionMessage}
          </p>
        ) : null}
      </Section>

      <Section title="Missing Scope Checklist" subtitle="Clear these items before you treat the bid as final.">
        {missingScopeChecklist.length ? (
          <div className="checklistList">
            {missingScopeChecklist.map((item) => (
              <div className="checklistItem" key={item.label}>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="checklistEmpty">All required scope items are filled in. The estimate is ready for bid.</div>
        )}
      </Section>
      </SafeTileSection>
    </div>
  );
}
