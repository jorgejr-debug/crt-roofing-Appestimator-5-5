export default function ShingleWorkspace({ workspace }) {
  const {
    DetailRow,
    Field,
    OverheadCalculator,
    Section,
    TravelCalculator,
    addShingleLaborSection,
    addShingleSubcontractorItem,
    addTravelVehicleSelection,
    calculation,
    css,
    googleDebug,
    handleCalculateDistance,
    handleConvertCurrentEstimateToProposal,
    handleDownloadEstimatePDF,
    handleNumberInputWheel,
    handleSaveEstimate,
    handleSelectZeroOnFocus,
    handleSelectedMarkup,
    inputs,
    isLoaded,
    isLookingUpDistance,
    loadError,
    money2,
    normalizeShingleLaborSections,
    num,
    removeShingleLaborSection,
    removeShingleSubcontractorItem,
    removeTravelVehicleSelection,
    renderEstimatorShellHeader,
    renderQuickMeasureReviewPanel,
    setField,
    setInputs,
    setShingleLaborSection,
    setShingleSubcontractorItem,
    setTravelField,
    setTravelVehicleSelection,
    travelLookupMessage,
  } = workspace;

  return (
    <div className="appShell" onFocusCapture={handleSelectZeroOnFocus}>
      <style>{css}</style>
      {renderEstimatorShellHeader({
        title: "Shingle Estimate",
        intro: "Shingle template with measurements, material takeoff, labor, travel, and markup totals.",
      })}

      {renderQuickMeasureReviewPanel()}

      <Section title="Job Information" subtitle="Capture the project details for this shingle estimate.">
        <div className="formGrid">
          <Field label="Job name">
            <input
              type="text"
              value={inputs.shingleJobName}
              onChange={(e) =>
                setInputs((current) => ({
                  ...current,
                  shingleJobName: e.target.value,
                  jobName: e.target.value,
                }))
              }
            />
          </Field>
          <Field label="Customer">
            <input
              type="text"
              value={inputs.shingleCustomerName}
              onChange={(e) =>
                setInputs((current) => ({
                  ...current,
                  shingleCustomerName: e.target.value,
                  customerName: e.target.value,
                }))
              }
            />
          </Field>
          <Field label="Job address">
            <div style={{ display: "grid", gap: 8 }}>
              <input
                type="text"
                value={inputs.shingleJobAddress}
                onChange={(e) =>
                  setInputs((current) => ({
                    ...current,
                    shingleJobAddress: e.target.value,
                    jobAddress: e.target.value,
                    jobSiteAddress: e.target.value,
                    travelDistanceSource: "manual",
                  }))
                }
              />
              <button type="button" className="secondaryButton" onClick={handleCalculateDistance}>
                Search travel distance
              </button>
            </div>
          </Field>
          <Field label="Salesperson">
            <input
              type="text"
              value={inputs.shingleSalesperson}
              onChange={(e) => setField("shingleSalesperson", e.target.value)}
            />
          </Field>
          <Field label="City permit fee">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.01"
              value={inputs.shingleCityPermitFee}
              onChange={(e) => setField("shingleCityPermitFee", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Manual Roof Measurements" subtitle="Enter roof dimensions and waste to drive the shingle takeoff.">
        <div className="formGrid">
          <Field label="Roof squares">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={inputs.shingleTotalRoofSquares}
              onChange={(e) => setField("shingleTotalRoofSquares", e.target.value)}
            />
          </Field>
          <Field label="Waste percentage">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={inputs.shingleWastePercent}
              onChange={(e) => setField("shingleWastePercent", e.target.value)}
            />
          </Field>
          <Field label="Valley linear feet"><input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.shingleValleyLf} onChange={(e) => setField("shingleValleyLf", e.target.value)} /></Field>
          <Field label="Ridge linear feet"><input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.shingleRidgeLf} onChange={(e) => setField("shingleRidgeLf", e.target.value)} /></Field>
          <Field label="Hip linear feet"><input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.shingleHipLf} onChange={(e) => setField("shingleHipLf", e.target.value)} /></Field>
          <Field label="Drip edge / perimeter linear feet"><input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.shingleDripEdgeLf} onChange={(e) => setField("shingleDripEdgeLf", e.target.value)} /></Field>
          <Field label="Starter linear feet"><input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.shingleStarterLf} onChange={(e) => setField("shingleStarterLf", e.target.value)} /></Field>
          <Field label="Pipe jacks count"><input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.shinglePipeJacksCount} onChange={(e) => setField("shinglePipeJacksCount", e.target.value)} /></Field>
          <Field label="Vents count"><input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.shingleVentsCount} onChange={(e) => setField("shingleVentsCount", e.target.value)} /></Field>
          <Field label="Skylights count"><input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.shingleSkylightsCount} onChange={(e) => setField("shingleSkylightsCount", e.target.value)} /></Field>
          <Field label="Chimney count"><input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.shingleChimneyCount} onChange={(e) => setField("shingleChimneyCount", e.target.value)} /></Field>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Manual measurement mode" value="Active" note="Quantities are calculated from entered roof measurements." />
          <DetailRow label="Starter bundles calculated" value={num(Math.max(0, Math.ceil((calculation.starterLf || 0) / 115)), 2)} />
          <DetailRow label="Rapid Ridge boxes calculated" value={num(Math.max(0, Math.ceil((calculation.ridgeLf || 0) / 20)), 2)} />
          <DetailRow label="Valley pieces calculated" value={num(Math.max(0, Math.ceil((calculation.valleyLf || 0) / 10)), 2)} />
          <DetailRow label="Production squares" value={num(calculation.productionSquares, 2)} />
          <DetailRow label="Total roof squares" value={num(calculation.totalRoofSquares, 2)} />
        </div>
      </Section>

      <Section title="Material Calculations" subtitle="Editable pricing for the shingle material stack.">
        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Unit Cost</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const groupDefinitions = [
                  {
                    title: "Main Roofing Materials",
                    keys: ["shingles", "underlayment", "starter", "ridgeCap"],
                  },
                  {
                    title: "Metal / Edge",
                    keys: ["dripEdge", "valleyMetal"],
                  },
                  {
                    title: "Nails / Paint / Sealant",
                    keys: ["coilNails125", "coilNails78", "markingPaint", "caulkingSealantTube"],
                  },
                  {
                    title: "Roof Jacks / Vents",
                    keys: ["roofJack15", "roofJack2", "roofJack3", "roofJack4", "ovalRoofJack", "americapRound", "americapOval", "ohaginVent", "dormerVent"],
                  },
                  {
                    title: "Wood / Misc",
                    keys: ["tinShingles", "cdxPlywood", "roofConveyorDeliveryCharge", "fuelSurcharge"],
                  },
                ];
                const itemsByKey = new Map(calculation.materialItems.map((item) => [item.key, item]));
                return groupDefinitions.flatMap((group) => {
                  const rows = [
                    <tr key={`group-${group.title}`} className="sectionDivider">
                      <td colSpan={5}>
                        <strong>{group.title}</strong>
                      </td>
                    </tr>,
                    ...group.keys
                      .map((key) => itemsByKey.get(key))
                      .filter(Boolean)
                      .map((item) => (
                        <tr key={item.key}>
                          <td>{item.label}</td>
                          <td>
                            <div>
                              <input
                                type="number" onWheel={handleNumberInputWheel}
                                min="0"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) => {
                                  const inputKeyMap = {
                                  shingles: "shingleHdzBundlesNeeded",
                                  underlayment: "shingleSyntheticUnderlaymentRolls",
                                    starter: "shingleStarterQuantity",
                                    ridgeCap: "shingleRapidRidgeBoxes",
                                    dripEdge: "shingleDripEdgePieces",
                                    coilNails125: "shingleCoilNails125Quantity",
                                    coilNails78: "shingleCoilNails78Quantity",
                                    markingPaint: "shingleMarkingPaintQuantity",
                                    caulkingSealantTube: "shingleCaulkingSealantTubeQuantity",
                                    roofJack15: "shingleRoofJack15Quantity",
                                    roofJack2: "shingleRoofJack2Quantity",
                                    roofJack3: "shingleRoofJack3Quantity",
                                    roofJack4: "shingleRoofJack4Quantity",
                                    ovalRoofJack: "shingleOvalRoofJackQuantity",
                                    americapRound: "shingleAmericapRoundQuantity",
                                    americapOval: "shingleAmericapOvalQuantity",
                                    ohaginVent: "shingleOHaginVentQuantity",
                                    dormerVent: "shingleDormerVentQuantity",
                                    tinShingles: "shingleTinShinglesQuantity",
                                    cdxPlywood: "shinglePlywoodSheets",
                                    valleyMetal: "shingleValleyMetalQuantity",
                                    roofConveyorDeliveryCharge: "shingleRoofConveyorDeliveryChargeQuantity",
                                    fuelSurcharge: "shingleFuelSurchargeQuantity",
                                  };
                                  const mappedKey = inputKeyMap[item.key];
                                  if (mappedKey) setField(mappedKey, e.target.value);
                                }}
                                />
                              {item.helperText ? <div className="fieldHint" style={{ marginTop: 4 }}>{item.helperText}</div> : null}
                            </div>
                          </td>
                          <td>{item.unit}</td>
                          <td>
                            <input
                              type="number" onWheel={handleNumberInputWheel}
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const priceKeyMap = {
                                  shingles: "shingleShinglesPerSquareCost",
                                  underlayment: "shingleSyntheticUnderlaymentRollCost",
                                  starter: "shingleStarterCost",
                                  ridgeCap: "shingleRidgeCapCost",
                                  dripEdge: "shingleDripEdgeCost",
                                  coilNails125: "shingleCoilNails125Cost",
                                  coilNails78: "shingleCoilNails78Cost",
                                  markingPaint: "shingleMarkingPaintCost",
                                  caulkingSealantTube: "shingleCaulkingSealantTubeCost",
                                  roofJack15: "shingleRoofJack15Cost",
                                  roofJack2: "shingleRoofJack2Cost",
                                  roofJack3: "shingleRoofJack3Cost",
                                  roofJack4: "shingleRoofJack4Cost",
                                  ovalRoofJack: "shingleOvalRoofJackCost",
                                  americapRound: "shingleAmericapRoundCost",
                                  americapOval: "shingleAmericapOvalCost",
                                  ohaginVent: "shingleOHaginVentCost",
                                  dormerVent: "shingleDormerVentCost",
                                  tinShingles: "shingleTinShinglesCost",
                                  cdxPlywood: "shinglePlywoodSheetCost",
                                  valleyMetal: "shingleValleyMetalCost",
                                  roofConveyorDeliveryCharge: "shingleRoofConveyorDeliveryCharge",
                                  fuelSurcharge: "shingleFuelSurcharge",
                                };
                                const mappedKey = priceKeyMap[item.key];
                                if (mappedKey) setField(mappedKey, e.target.value);
                              }}
                            />
                          </td>
                          <td>{money2(item.amount)}</td>
                        </tr>
                      )),
                  ];
                  return rows;
                });
              })()}
            </tbody>
          </table>
        </div>
        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow
            label="Total HDZ RS+ Bundles Needed"
            value={num(calculation.shingleHdzBundlesNeeded, 2)}
            note={calculation.shingleMaterialFallbackNotes?.includes("Using calculated fallback.") ? "Using calculated fallback." : ""}
          />
          <DetailRow
            label="Pro-Start Starter"
            value={num(calculation.shingleStarterQuantity, 2)}
            note={calculation.shingleStarterSuggestedQuantity > 0 ? "" : "Using calculated fallback."}
          />
          <DetailRow
            label='2"x2" Drip Edge 10 ft Pieces'
            value={num(calculation.shingleDripEdgePieces, 2)}
            note={calculation.shingleDripEdgeSuggestedPieces > 0 ? "" : "Using calculated fallback."}
          />
          <DetailRow
            label='Rapid Ridge 8" Ridge Cap'
            value={num(calculation.shingleRapidRidgeBoxes, 2)}
            note={calculation.shingleRapidRidgeLFUsed > 0 ? `${num(calculation.shingleRapidRidgeLFUsed, 1)} LF used` : ""}
          />
          <DetailRow
            label="Suggested GAF quantity"
            value={num(calculation.shingleSyntheticUnderlaymentSuggestedRolls, 2)}
            note={calculation.shingleSyntheticUnderlaymentSuggestedRolls > 0 ? "" : "Using calculated fallback."}
          />
          <DetailRow
            label="Calculated fallback quantity"
            value={num(calculation.shingleSyntheticUnderlaymentCalculatedRolls, 2)}
            note={calculation.shingleSyntheticUnderlaymentSuggestedRolls > 0 ? "" : "Using calculated fallback."}
          />
          <DetailRow
            label="Final underlayment rolls used"
            value={num(calculation.shingleSyntheticUnderlaymentRolls, 2)}
            note={calculation.shingleSyntheticUnderlaymentSuggestedRolls > 0 ? "" : "Using calculated fallback."}
          />
          <DetailRow label="Total material cost" value={money2(calculation.materialCost)} />
        </div>
      </Section>

      <Section title="Subcontractor" subtitle="Add subcontractor line items for tear-off and additional partner costs.">
        <div className="formGrid">
          <Field label="Tear-Off Pricing Unit">
            <select value={inputs.shingleTearOffPricingUnit} onChange={(e) => setField("shingleTearOffPricingUnit", e.target.value)}>
              <option value="SQ">SQ</option>
              <option value="Section">Section</option>
              <option value="Hour">Hour</option>
              <option value="Day">Day</option>
              <option value="Flat rate">Flat rate</option>
              <option value="Other">Other</option>
            </select>
          </Field>
        </div>

        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Subcontractor</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Cost per unit</th>
                <th>Licensed?</th>
                <th>Workers comp</th>
                <th>Total cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {calculation.shingleSubcontractorItems.map((item, index) => (
                <tr key={`${item.type || "subcontractor"}-${index}`}>
                  <td>
                    {index === 0 ? (
                      item.type
                    ) : (
                      <input
                        className="tableInput"
                        type="text"
                        value={item.type}
                        placeholder="other subcontractor"
                        onChange={(e) => setShingleSubcontractorItem(index, "type", e.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      className="tableInput"
                      type="number" onWheel={handleNumberInputWheel}
                      min="0"
                      step="0.01"
                      value={item.quantity ?? 0}
                      onChange={(e) => setShingleSubcontractorItem(index, "quantity", e.target.value)}
                    />
                  </td>
                  <td>
                    {index === 0 ? (
                      calculation.shingleTearOffPricingUnit || "SQ"
                    ) : (
                      <input
                        className="tableInput"
                        type="text"
                        value={item.unit}
                        placeholder="unit"
                        onChange={(e) => setShingleSubcontractorItem(index, "unit", e.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      className="tableInput"
                      type="number" onWheel={handleNumberInputWheel}
                      min="0"
                      step="0.01"
                      value={item.unitPrice ?? 0}
                      onChange={(e) => setShingleSubcontractorItem(index, "unitPrice", e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      value={item.licensed ? "yes" : "no"}
                      onChange={(e) => setShingleSubcontractorItem(index, "licensed", e.target.value === "yes")}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </td>
                  <td>{money2(item.workersCompCost || 0)}</td>
                  <td>{money2(item.totalCost || 0)}</td>
                  <td>
                    {index > 0 ? (
                      <button type="button" className="secondaryButton" onClick={() => removeShingleSubcontractorItem(index)}>
                        Remove
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="actionRow" style={{ marginTop: 14 }}>
          <button type="button" className="secondaryButton" onClick={addShingleSubcontractorItem}>
            Add subcontractor
          </button>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Subcontractor rows" value={num(calculation.shingleSubcontractorItems.length, 0)} />
          <DetailRow label="Total subcontractor cost" value={money2(calculation.shingleSubcontractorCost || 0)} />
        </div>
      </Section>

      <Section title="Labor" subtitle="Choose who performs the labor and calculate the labor cost from here.">
        <div className="formGrid">
          <Field label="Is this project going to be performed in-house or sub-contracted?">
            <select value={inputs.shingleLaborType} onChange={(e) => setField("shingleLaborType", e.target.value)}>
              <option value="inHouse">In-house</option>
              <option value="subcontracted">Sub-contracted</option>
            </select>
          </Field>
        </div>

        {String(inputs.shingleLaborType || "inHouse") === "inHouse" ? (
          <>
            <div className="formGrid" style={{ marginTop: 14 }}>
              <Field label="Laborers per day">
                <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.shingleLaborersPerDay} onChange={(e) => setField("shingleLaborersPerDay", e.target.value)} />
              </Field>
              <Field label="Total days on job">
                <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.shingleTotalDaysOnJob} onChange={(e) => setField("shingleTotalDaysOnJob", e.target.value)} />
              </Field>
              <Field label="Labor hourly rate">
                <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={inputs.shingleLaborHourlyRate} onChange={(e) => setField("shingleLaborHourlyRate", e.target.value)} />
              </Field>
              <Field label="Hours per day">
                <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.shingleHoursPerDay} onChange={(e) => setField("shingleHoursPerDay", e.target.value)} />
              </Field>
            </div>
            <div className="detailList" style={{ marginTop: 14 }}>
              <DetailRow label="In-house labor cost" value={money2(calculation.laborCost)} />
            </div>
          </>
        ) : (
          <>
            <div className="formGrid" style={{ marginTop: 14 }}>
              <Field label="Is subcontractor licensed?">
                <select value={String(inputs.shingleSubcontractorLicensed ? "yes" : "no")} onChange={(e) => setField("shingleSubcontractorLicensed", e.target.value === "yes")}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Does subcontractor carry workers comp?">
                <select value={String(inputs.shingleSubcontractorWorkersComp ? "yes" : "no")} onChange={(e) => setField("shingleSubcontractorWorkersComp", e.target.value === "yes")}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
            </div>
            <div className="actionRow" style={{ marginTop: 12 }}>
              <button type="button" className="secondaryButton" onClick={addShingleLaborSection}>
                Add subcontractor section
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => removeShingleLaborSection((normalizeShingleLaborSections(inputs.shingleLaborSections).length || 1) - 1)}
              >
                Remove section
              </button>
            </div>
            <div className="detailList" style={{ marginTop: 14 }}>
              {normalizeShingleLaborSections(inputs.shingleLaborSections).map((section, index) => {
                const sectionInstallTotal = calculation.shingleSubcontractorSections?.[index]?.sectionInstallTotal ?? 0;
                return (
                  <div className="summaryCard" key={section.id || index}>
                    <h3 style={{ marginTop: 0 }}>Subcontractor Section {index + 1}</h3>
                    <div className="formGrid">
                      <Field label="Section name">
                        <input type="text" value={section.label} onChange={(e) => setShingleLaborSection(index, "label", e.target.value)} />
                      </Field>
                      <Field label="Install squares">
                        <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={section.installSquares} onChange={(e) => setShingleLaborSection(index, "installSquares", e.target.value)} />
                      </Field>
                      <Field label="Cost per install SQ">
                        <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={section.costPerInstallSq} onChange={(e) => setShingleLaborSection(index, "costPerInstallSq", e.target.value)} />
                      </Field>
                    </div>
                    <div className="detailList" style={{ marginTop: 10 }}>
                      <DetailRow label="Section install total" value={money2(sectionInstallTotal)} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="detailList" style={{ marginTop: 14 }}>
              <DetailRow label="Subcontractor install subtotal" value={money2(calculation.shingleSubcontractorInstallSubtotal || 0)} />
              <DetailRow label="Workers comp / risk add-on" value={money2(calculation.shingleWorkersCompRiskAddOn || 0)} />
              <DetailRow label="Total subcontractor labor cost" value={money2(calculation.shingleTotalSubcontractorLaborCost || 0)} />
            </div>
          </>
        )}
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
        oneWayMilesLabel="One-way miles"
        onJobSiteAddressChange={(value) => setTravelField("jobSiteAddress", value)}
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

      <OverheadCalculator
        inputs={inputs}
        calculation={calculation}
        onOverheadPercentChange={(value) => setField("overheadPercent", value)}
        onScopeAddersChange={(value) => setField("scopeAdders", value)}
        onMiscCostChange={(value) => setField("miscCost", value)}
        subtitle="Apply overhead before markup is calculated."
      />

      <Section title="Totals / Markup" subtitle="Job cost, markup table, and bid selection.">
        <div className="detailList">
          <DetailRow label="Material cost" value={money2(calculation.materialCost)} />
          <DetailRow label="Labor cost" value={money2(calculation.laborCost)} />
          {calculation.prevailingWageJob ? (
            <DetailRow label="Prevailing wage labor" value={money2(calculation.prevailingWageLaborCost)} />
          ) : null}
          <DetailRow label="Subcontractor cost" value={money2(calculation.shingleSubcontractorCost || 0)} />
          <DetailRow label="Travel cost" value={money2(calculation.travelCost)} />
          <DetailRow label="City permit fee" value={money2(calculation.cityPermitFee)} />
          <DetailRow label="Equipment / rental total" value={money2(calculation.equipmentRentalTotal)} />
          <DetailRow label="Total job cost" value={money2(calculation.totalJobCost)} />
          <DetailRow label="Price per square" value={money2(calculation.selectedPricePerSq)} />
        </div>

        <div className="tableWrap" style={{ marginTop: 14 }}>
          <table className="dataTable">
            <thead>
              <tr>
                <th>Markup %</th>
                <th>Bid Amount</th>
                <th>Profit</th>
                <th>Price Per SQ</th>
              </tr>
            </thead>
            <tbody>
              {calculation.bidOptions.options.map((option) => (
                <tr
                  key={option.percent}
                  className={`markupTableRow ${option.percent === calculation.selectedMarkupPercent ? "active" : ""}`}
                  onClick={() => handleSelectedMarkup(option.percent)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectedMarkup(option.percent);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${option.percent}% markup row`}
                >
                  <td>{option.percent}%</td>
                  <td>{money2(option.bidAmount)}</td>
                  <td>{money2(option.profitDollars)}</td>
                  <td>{money2(option.pricePerSq)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="summaryCard" style={{ marginTop: 14 }}>
          <h3>Custom Bid Amount</h3>
          <label>Custom Bid Amount</label>
          <input
            type="number" onWheel={handleNumberInputWheel}
            min="0"
            step="0.01"
            value={inputs.shingleCustomBidAmount}
            onChange={(e) => setField("shingleCustomBidAmount", e.target.value)}
          />
          <DetailRow label="Custom Profit" value={money2(calculation.customProfitDollars)} />
          <DetailRow label="Custom Price Per Square" value={money2(calculation.customPricePerSq)} />
        </div>

        <div className="summaryGrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 14 }}>
          <div className="summaryCard">
            <span>Selected bid</span>
            <strong>{money2(calculation.selectedBidAmount)}</strong>
            <p style={{ marginBottom: 0, color: "var(--muted)" }}>
              {calculation.customBidSelected ? "Custom Bid" : `${num(calculation.selectedMarkupPercent, 0)}% markup`} · Profit {money2(calculation.selectedProfitDollars)} · {money2(calculation.selectedPricePerSq)} / SQ
            </p>
          </div>
        </div>
      </Section>

      <div className="actionRow" style={{ marginTop: 16 }}>
        <button type="button" className="primaryButton" onClick={handleSaveEstimate}>
          Save Estimate
        </button>
        <button type="button" className="secondaryButton" onClick={handleConvertCurrentEstimateToProposal}>
          Generate Proposal
        </button>
        <button type="button" className="secondaryButton" onClick={handleDownloadEstimatePDF}>
          Download Estimate PDF
        </button>
      </div>
    </div>
  );
}
