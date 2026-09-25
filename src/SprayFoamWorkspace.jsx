export default function SprayFoamWorkspace({ workspace }) {
  const {
    DetailRow,
    Field,
    OverheadCalculator,
    Section,
    TravelCalculator,
    addSprayFoamAdditionalDetailMaterial,
    addSprayFoamEquipmentRental,
    addSprayFoamRoofArea,
    addTravelVehicleSelection,
    calculation,
    css,
    deleteSprayFoamAdditionalDetailMaterial,
    deleteSprayFoamEquipmentRental,
    deleteSprayFoamRoofArea,
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
    money,
    money2,
    normalizeSprayFoamAdditionalDetailMaterials,
    normalizeSprayFoamEquipmentRentals,
    normalizeSprayFoamLayerConfig,
    num,
    removeTravelVehicleSelection,
    renderEstimatorShellHeader,
    renderQuickMeasureReviewPanel,
    setField,
    setInputs,
    setSprayFoamAdditionalDetailMaterial,
    setSprayFoamDetailMaterial,
    setSprayFoamEquipmentRental,
    setSprayFoamEstimatedDays,
    setSprayFoamLayerConfig,
    setSprayFoamRoofArea,
    setSprayFoamSubcontractorItem,
    setTravelField,
    setTravelVehicleSelection,
    toNumber,
    travelLookupMessage,
  } = workspace;

  return (
    <div className="appShell" onFocusCapture={handleSelectZeroOnFocus}>
      <style>{css}</style>
      {renderEstimatorShellHeader({
        title: "Spray Foam Estimate",
        intro: "Squares-based spray foam template with material, labor, travel, and markup totals.",
      })}

      {renderQuickMeasureReviewPanel()}

      <Section title="Estimate Type" subtitle="Choose the spray foam application type before entering measurements.">
        <div className="formGrid">
          <Field label="Is this a roof spray foam estimate or wall foam / insulation estimate?">
            <select
              value={inputs.sprayFoamEstimateType || "roof"}
              onChange={(e) => setField("sprayFoamEstimateType", e.target.value)}
            >
              <option value="roof">Roof spray foam estimate</option>
              <option value="wall">Wall foam / insulation estimate</option>
            </select>
          </Field>
          {(inputs.sprayFoamEstimateType || "roof") === "wall" ? (
            <Field label="Wall foam charge method">
              <select
                value={inputs.wallFoamChargeMethod || "prorated"}
                onChange={(e) => setField("wallFoamChargeMethod", e.target.value)}
              >
                <option value="prorated">Pro-rated material charge</option>
                <option value="fullKit">Full kit charge</option>
              </select>
            </Field>
          ) : null}
        </div>
        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow
            label="Selected estimate type"
            value={(inputs.sprayFoamEstimateType || "roof") === "wall" ? "Wall foam / insulation" : "Roof spray foam"}
          />
          <DetailRow
            label="Base foam set"
            value={(inputs.sprayFoamEstimateType || "roof") === "wall"
              ? `45 SQ / set • $2,800.00`
              : `26 SQ / kit • $2,600.00`}
          />
          {(inputs.sprayFoamEstimateType || "roof") === "wall" ? (
            <>
              <DetailRow label="Foam charge method" value={String(inputs.wallFoamChargeMethod || "prorated") === "fullKit" ? "Full kit charge" : "Pro-rated material charge"} />
              <DetailRow label="Full kits needed for ordering" value={num(calculation.wallFoamFullKitsNeeded ?? calculation.foamKitsNeeded, 0)} />
              <DetailRow label="Wall foam usage ratio" value={num(calculation.wallFoamUsageRatio, 3)} />
              <DetailRow label="Foam material charged to customer" value={money2(calculation.wallFoamMaterialCost ?? calculation.foamMaterialCost)} />
            </>
          ) : null}
        </div>
      </Section>

      <Section title="Job Information" subtitle="Capture the core spray foam project details.">
        <div className="formGrid">
          <Field label="Job name">
            <input type="text" value={inputs.jobName} onChange={(e) => setField("jobName", e.target.value)} />
          </Field>
          <Field label="Customer">
            <input type="text" value={inputs.customerName} onChange={(e) => setField("customerName", e.target.value)} />
          </Field>
          <Field label="Job address">
            <div style={{ display: "grid", gap: 8 }}>
              <input
                type="text"
                value={inputs.jobAddress}
                onChange={(e) =>
                  setInputs((current) => ({
                    ...current,
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
          <Field label="City permit fee">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.01"
              value={inputs.sprayFoamCityPermitFee}
              onChange={(e) => setField("sprayFoamCityPermitFee", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Field Measurements" subtitle="Capture roof dimensions used throughout the spray foam estimate.">
        <div className="formGrid">
          <Field label="Separate Roof Areas With Different Foam Thickness?">
            <select
              value={inputs.sprayFoamSeparateRoofAreas ? "yes" : "no"}
              onChange={(e) => setField("sprayFoamSeparateRoofAreas", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
        </div>

        {inputs.sprayFoamSeparateRoofAreas ? (
          <div style={{ marginTop: 14 }}>
            <div className="tableWrap">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Roof area</th>
                    <th>Field roof squares</th>
                    <th>Foam thickness (in)</th>
                    <th>Has parapet walls?</th>
                    <th>Parapet wall squares</th>
                    <th>Total area squares</th>
                    <th>Yield / kit</th>
                    <th>{(inputs.sprayFoamEstimateType || "roof") === "wall" ? "Sets needed" : "SPF used"}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {calculation.roofAreas.map((row, index) => (
                    <tr key={`roof-area-${index}`}>
                      <td>
                        <input
                          className="tableInput"
                          type="text"
                          value={row.label}
                          placeholder={`Roof area ${index + 1}`}
                          onChange={(e) => setSprayFoamRoofArea(index, "label", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="tableInput"
                          type="number" onWheel={handleNumberInputWheel}
                          min="0"
                          step="0.1"
                          value={row.fieldRoofSquares}
                          onChange={(e) => setSprayFoamRoofArea(index, "fieldRoofSquares", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="tableInput"
                          type="number" onWheel={handleNumberInputWheel}
                          min="0"
                          max="16"
                          step="0.1"
                          value={row.foamThicknessInches}
                          onChange={(e) => setSprayFoamRoofArea(index, "foamThicknessInches", e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="tableInput"
                          value={row.hasParapetWalls ? "yes" : "no"}
                          onChange={(e) => setSprayFoamRoofArea(index, "hasParapetWalls", e.target.value === "yes")}
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </td>
                      <td>
                        {row.hasParapetWalls ? (
                          <input
                            className="tableInput"
                            type="number" onWheel={handleNumberInputWheel}
                            min="0"
                            step="0.1"
                            value={row.parapetWallSquares}
                            onChange={(e) => setSprayFoamRoofArea(index, "parapetWallSquares", e.target.value)}
                          />
                        ) : (
                          <span>{num(row.parapetWallSquares || 0, 2)}</span>
                        )}
                      </td>
                      <td>{num(row.totalAreaSquares, 2)}</td>
                      <td>{num(row.yieldPerKit, 2)}</td>
                      <td>{num(row.kitsNeeded, 3)}</td>
                      <td>
                        <button type="button" className="dangerButton" onClick={() => deleteSprayFoamRoofArea(index)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="actionRow" style={{ marginTop: 12 }}>
              <button type="button" className="secondaryButton" onClick={addSprayFoamRoofArea}>
                Add roof area
              </button>
            </div>
          </div>
        ) : (
          <div className="formGrid" style={{ marginTop: 14 }}>
            <Field label="Field roof squares">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="0.1"
                value={inputs.sprayFoamFieldRoofSquares}
                onChange={(e) => setField("sprayFoamFieldRoofSquares", e.target.value)}
              />
            </Field>
            <Field label="Parapet wall squares">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="0.1"
                value={inputs.sprayFoamParapetWallSquares}
                onChange={(e) => setField("sprayFoamParapetWallSquares", e.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Total field squares" value={num(calculation.fieldSquares ?? calculation.totalFieldSquares ?? calculation.fieldRoofSquares, 2)} />
          <DetailRow label="Total parapet wall squares" value={num(calculation.parapetWallSquares ?? calculation.totalParapetWallSquares ?? calculation.totalParapetSquares, 2)} />
          <DetailRow label="Total roof squares" value={num(calculation.totalRoofSquares, 2)} />
          <DetailRow label={calculation.isWallFoamEstimate ? "Total foam sets" : "SPF material used"} value={num(calculation.totalFoamKits ?? calculation.foamKitsNeeded, calculation.isWallFoamEstimate ? 0 : 3)} />
          <DetailRow label="SPF usage cost" value={money2(calculation.totalFoamCost ?? calculation.foamMaterialCost)} />
        </div>
      </Section>

      <Section title="SPF material calculations" subtitle="Foam thickness, coatings, and material quantities.">
        <p className="smallNote" style={{ marginTop: 0 }}>
          Enter 0 inches for an acrylic-coating-only estimate. Spray foam quantity and cost will be removed.
        </p>
        <div className="formGrid">
          <Field label="Selected foam thickness (inches)">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              max="16"
              step="0.1"
              value={inputs.sprayFoamFieldThickness}
              onChange={(e) => setField("sprayFoamFieldThickness", e.target.value)}
            />
          </Field>
          <Field label="Wall thickness">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={inputs.sprayFoamWallThickness}
              onChange={(e) => setField("sprayFoamWallThickness", e.target.value)}
            />
          </Field>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow
            label="Selected foam thickness"
            value={calculation.selectedFoamThicknessInches > 0 ? `${num(calculation.selectedFoamThicknessInches, 1)} in` : "0 in — acrylic coating only"}
          />
          <DetailRow label={calculation.isWallFoamEstimate ? "Yield per set" : "Yield per kit"} value={`${num(calculation.yieldPerKitAtSelectedThickness, 2)} squares`} />
          <DetailRow label={calculation.isWallFoamEstimate ? "Sets needed" : "SPF material used"} value={num(calculation.foamKitsNeeded, calculation.isWallFoamEstimate ? 0 : 3)} />
          <DetailRow label={calculation.isWallFoamEstimate ? "Set cost" : "Kit cost"} value={money2(calculation.foamKitCost)} />
          <DetailRow label="Total material cost" value={money2(calculation.totalMaterialCost)} />
        </div>

        <div className="sectionTitle" style={{ marginTop: 16 }}>
          <h3>Material items</h3>
        </div>
        <div className="tableWrap" style={{ marginTop: 14 }}>
          <table className="dataTable">
            <thead>
              <tr>
                <th>Material item</th>
                <th>Quantity</th>
                <th>Unit cost</th>
                <th>Total cost</th>
              </tr>
            </thead>
            <tbody>
              {calculation.sprayFoamMaterialItems.map((item) => (
                <tr key={item.key}>
                  <td>{item.label}</td>
                  <td>{`${num(item.quantity || 0, 2)} ${item.unit || ""}`.trim()}</td>
                  <td>{money2(item.unitPrice || 0)}</td>
                  <td>{money2(item.amount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="tableWrap" style={{ marginTop: 14 }}>
          <table className="dataTable">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Applicable?</th>
                <th>Squares needed</th>
                <th>Coverage (SQ/Drum)</th>
                <th>Drums needed</th>
                <th>Drum cost</th>
                <th>Total cost</th>
              </tr>
            </thead>
            <tbody>
              {["primer", "baseCoat", "intermediateCoat1", "intermediateCoat2", "topCoat", "granules"].map((layerKey) => {
                const item = calculation.materialPricing.items.find((entry) => entry.key === layerKey) || {};
                const layerState = normalizeSprayFoamLayerConfig(inputs.sprayFoamLayerConfig)[layerKey] || {};
                const coverageUnit = layerKey === "granules" ? "SQ/Bag" : "SQ/Drum";
                return (
                  <tr key={layerKey}>
                    <td>{item.label || layerKey}</td>
                    <td>
                      <select
                        value={layerState.applicable ? "yes" : "no"}
                        onChange={(e) => setSprayFoamLayerConfig(layerKey, "applicable", e.target.value === "yes")}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </td>
                    <td>{`${num(item.squaresNeeded || 0, 0)} SQ`}</td>
                    <td>{`${num(layerState.coverageRate || item.coverageRate || 0, layerKey === "granules" ? 2 : 0)} ${coverageUnit}`}</td>
                    <td>{num(item.drumsNeeded || 0, 0)}</td>
                    <td>{money2(item.unitPrice || 0)}</td>
                    <td>{money2(item.amount || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="SPF usage cost" value={money2(calculation.foamMaterialCost)} />
          <DetailRow label="Drip edge cost" value={money2(calculation.foamStopDripEdgeCost)} />
        </div>
      </Section>

      <Section title="Spray Foam Detail Materials" subtitle="Add project-specific detail materials and secure rock quantities.">
        <div className="formGrid" style={{ marginBottom: 14 }}>
          <Field label="Total linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={inputs.sprayFoamLinearFeet}
              onChange={(e) => setField("sprayFoamLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Drip edge metal required?">
            <select
              value={inputs.sprayFoamDripEdgeRequired ? "yes" : "no"}
              onChange={(e) => setField("sprayFoamDripEdgeRequired", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
        </div>

        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit cost</th>
                <th>Total cost</th>
              </tr>
            </thead>
            <tbody>
              {calculation.detailMaterialItems
                .filter((item) => !String(item.key || "").startsWith("customDetailMaterial-") && item.key !== "skylightCurbLumberOrder")
                .map((item) => (
                <tr key={item.key}>
                  <td>{item.label}</td>
                  <td>
                    {item.key === "secureRockDenseDeck" ? (
                      <div className="formStack" style={{ gap: 8 }}>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Manual</span>
                        <input
                          className="tableInput"
                          type="number" onWheel={handleNumberInputWheel}
                          min="0"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) =>
                            setSprayFoamDetailMaterial(item.key, "quantity", e.target.value)
                          }
                        />
                      </div>
                    ) : (
                      <input
                        className="tableInput"
                        type="number" onWheel={handleNumberInputWheel}
                        min="0"
                        step="0.1"
                        value={item.quantity}
                        onChange={(e) => setSprayFoamDetailMaterial(item.key, "quantity", e.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      className="tableInput"
                      type="number" onWheel={handleNumberInputWheel}
                      min="0"
                      step="0.01"
                      value={item.unitCost}
                      onChange={(e) => setSprayFoamDetailMaterial(item.key, "unitCost", e.target.value)}
                    />
                  </td>
                  <td>{money2(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(calculation.totalRoofLoadingQuantity || 0) > 0 ? (
          <div className="summaryCard" style={{ marginTop: 12 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>
              Skylight delivery
            </span>
            <label style={{ display: "block", marginBottom: 8, color: "var(--text-muted)", fontSize: "0.95rem" }}>
              Will skylights be roof loaded by distributor?
            </label>
            <select
              value={inputs.sprayFoamSkylightsRoofLoaded ? "yes" : "no"}
              onChange={(e) => setField("sprayFoamSkylightsRoofLoaded", e.target.value === "yes")}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            {inputs.sprayFoamSkylightsRoofLoaded ? (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", marginBottom: 8, color: "var(--text-muted)", fontSize: "0.95rem" }}>
                  Rooftop Delivery Fee
                </label>
                <input
                  type="number" onWheel={handleNumberInputWheel}
                  min="0"
                  step="0.01"
                  value={inputs.sprayFoamRooftopDeliveryFee}
                  onChange={(e) => setField("sprayFoamRooftopDeliveryFee", e.target.value)}
                />
              </div>
            ) : null}
            <p style={{ marginTop: 12, color: "var(--text-muted)" }}>
              Reminder: Coordinate skylights and roof hatch to be roof loaded at the same time to avoid multiple rooftop delivery trips.
            </p>
          </div>
        ) : null}

        {calculation.skylightCurbLumberOrderItem ? (
          <div className="summaryCard" style={{ marginTop: 12 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>
              Skylight Curb 2x8x12 Lumber Order
            </span>
            <div className="detailList">
              <DetailRow
                label="Outside curb size"
                value={`${num(calculation.skylightCurbLumberOutsideLengthInches || 97.5, 1)}" x ${num(calculation.skylightCurbLumberOutsideWidthInches || 49.5, 1)}"`}
              />
              <DetailRow
                label="Actual cut list per curb"
                value={`2 @ ${num(calculation.skylightCurbLumberOutsideLengthInches || 97.5, 1)}" and 2 @ ${num(calculation.skylightCurbLumberShortCutInches || 46.5, 1)}"`}
              />
              <DetailRow label="Skylight curb quantity" value={num(calculation.skylightCurbsQuantity || 0, 0)} />
              <DetailRow label="2x8x12 quantity" value={num(calculation.skylightCurbLumberBoardQuantity || 0, 0)} />
              <DetailRow label="Board unit cost" value={money(calculation.skylightCurbLumberBoardUnitCost || 0)} />
              <DetailRow label="Total lumber cost" value={money(calculation.skylightCurbLumberOrderItem.amount)} />
              <DetailRow label="Estimated waste inches" value={money2(calculation.skylightCurbLumberEstimatedWasteInches || 0)} />
              <DetailRow label="Estimated total lumber LF" value={money2(calculation.skylightCurbLumberEstimatedTotalLumberLF || 0)} />
            </div>
            <div className="formGrid" style={{ marginTop: 12 }}>
              <Field label="Board quantity">
                <input
                  type="number" onWheel={handleNumberInputWheel}
                  min="0"
                  step="1"
                  value={inputs.sprayFoamSkylightCurbLumberBoardQuantity}
                  placeholder={String(calculation.skylightCurbLumberBoardQuantity || 0)}
                  onChange={(e) => setField("sprayFoamSkylightCurbLumberBoardQuantity", e.target.value)}
                />
              </Field>
              <Field label="Unit cost per 2x8x12 board">
                <input
                  type="number" onWheel={handleNumberInputWheel}
                  min="0"
                  step="0.01"
                  value={inputs.sprayFoamSkylightCurbLumberBoardUnitCost}
                  onChange={(e) => setField("sprayFoamSkylightCurbLumberBoardUnitCost", e.target.value)}
                />
              </Field>
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <div className="actionRow">
            <button type="button" className="secondaryButton" onClick={addSprayFoamAdditionalDetailMaterial}>
              Add more material
            </button>
          </div>

          {Array.isArray(inputs.sprayFoamAdditionalDetailMaterials) && inputs.sprayFoamAdditionalDetailMaterials.length ? (
            <div className="tableWrap" style={{ marginTop: 12 }}>
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Material name</th>
                    <th>Quantity</th>
                    <th>Unit cost</th>
                    <th>Total cost</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {normalizeSprayFoamAdditionalDetailMaterials(inputs.sprayFoamAdditionalDetailMaterials).map((item, index) => (
                    <tr key={`custom-detail-${index}`}>
                      <td>
                        <input
                          className="tableInput"
                          type="text"
                          value={item.name}
                          placeholder="Material name"
                          onChange={(e) => setSprayFoamAdditionalDetailMaterial(index, "name", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="tableInput"
                          type="number" onWheel={handleNumberInputWheel}
                          min="0"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) => setSprayFoamAdditionalDetailMaterial(index, "quantity", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="tableInput"
                          type="number" onWheel={handleNumberInputWheel}
                          min="0"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => setSprayFoamAdditionalDetailMaterial(index, "unitCost", e.target.value)}
                        />
                      </td>
                      <td>{money2(toNumber(item.quantity, 0) * toNumber(item.unitCost, 0))}</td>
                      <td>
                        <button
                          type="button"
                          className="dangerButton"
                          onClick={() => deleteSprayFoamAdditionalDetailMaterial(index)}
                        >
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

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Total detail material cost" value={money2(calculation.totalDetailMaterialCost)} />
        </div>
      </Section>

      <Section title="Equipment & Rentals" subtitle="Add repeatable equipment or rental line items.">
        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rate type</th>
                <th>Rate amount</th>
                <th>Quantity</th>
                <th>Days</th>
                <th>Hours</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {normalizeSprayFoamEquipmentRentals(inputs.sprayFoamEquipmentRentals).map((item, index) => (
                <tr key={`equipment-rental-${index}`}>
                  <td>
                    <input
                      className="tableInput"
                      type="text"
                      value={item.name}
                      placeholder={`Equipment / rental ${index + 1}`}
                      onChange={(e) => setSprayFoamEquipmentRental(index, "name", e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="tableInput"
                      value={item.rateType}
                      onChange={(e) => setSprayFoamEquipmentRental(index, "rateType", e.target.value)}
                    >
                      <option value="perDay">Per day</option>
                      <option value="perHour">Per hour</option>
                      <option value="flat">Flat</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="tableInput"
                      type="number" onWheel={handleNumberInputWheel}
                      min="0"
                      step="0.01"
                      value={item.rateAmount}
                      onChange={(e) => setSprayFoamEquipmentRental(index, "rateAmount", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="tableInput"
                      type="number" onWheel={handleNumberInputWheel}
                      min="0"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) => setSprayFoamEquipmentRental(index, "quantity", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="tableInput"
                      type="number" onWheel={handleNumberInputWheel}
                      min="0"
                      step="1"
                      value={item.days}
                      onChange={(e) => setSprayFoamEquipmentRental(index, "days", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="tableInput"
                      type="number" onWheel={handleNumberInputWheel}
                      min="0"
                      step="0.1"
                      value={item.hours}
                      onChange={(e) => setSprayFoamEquipmentRental(index, "hours", e.target.value)}
                    />
                  </td>
                  <td>{money2(
                    item.rateType === "perDay"
                      ? item.rateAmount * item.quantity * item.days
                      : item.rateType === "perHour"
                        ? item.rateAmount * item.quantity * item.hours
                        : item.rateAmount * item.quantity
                  )}</td>
                  <td>
                    <button type="button" className="dangerButton" onClick={() => deleteSprayFoamEquipmentRental(index)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actionRow" style={{ marginTop: 12 }}>
          <button type="button" className="secondaryButton" onClick={addSprayFoamEquipmentRental}>
            Add equipment/rental
          </button>
        </div>
        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Equipment / rental total" value={money2(calculation.equipmentRentalTotal)} />
        </div>
      </Section>

      <Section title="Labor and Subcontractors Cost" subtitle="Labor staffing, subcontractor costs, and estimated labor cost.">
        <div className="formGrid">
          <Field label="Laborers needed per day">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={inputs.sprayFoamLaborersNeededPerDay}
              onChange={(e) => setField("sprayFoamLaborersNeededPerDay", e.target.value)}
            />
          </Field>
          <Field label="Total estimated days">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={inputs.sprayFoamEstimatedCompletionDays}
              onChange={(e) => setSprayFoamEstimatedDays(e.target.value)}
            />
          </Field>
          <Field label="Subcontractors on job?">
            <select value={inputs.sprayFoamHasSubcontractors ? "yes" : "no"} onChange={(e) => setField("sprayFoamHasSubcontractors", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Is this a prevailing wage job?">
            <select
              value={inputs.sprayFoamPrevailingWageJob ? "yes" : "no"}
              onChange={(e) => setField("sprayFoamPrevailingWageJob", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
        </div>

        {inputs.sprayFoamPrevailingWageJob ? (
          <div className="formGrid" style={{ marginTop: 14 }}>
            <Field label="Prevailing wage hourly rate">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="0.01"
                value={inputs.sprayFoamPrevailingWageHourlyRate}
                onChange={(e) => setField("sprayFoamPrevailingWageHourlyRate", e.target.value)}
              />
            </Field>
            <Field label="Crew size">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="1"
                value={inputs.sprayFoamPrevailingWageCrewSize}
                onChange={(e) => setField("sprayFoamPrevailingWageCrewSize", e.target.value)}
              />
            </Field>
            <Field label="Hours per day">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="0.1"
                value={inputs.sprayFoamPrevailingWageHoursPerDay}
                onChange={(e) => setField("sprayFoamPrevailingWageHoursPerDay", e.target.value)}
              />
            </Field>
            <Field label="Number of job days">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="1"
                value={inputs.sprayFoamPrevailingWageJobDays}
                onChange={(e) => setField("sprayFoamPrevailingWageJobDays", e.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {inputs.sprayFoamHasSubcontractors ? (
          <div className="tableWrap" style={{ marginTop: 14 }}>
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Subcontractor</th>
                  <th>Unit / squares</th>
                  <th>Cost per unit</th>
                  <th>Licensed?</th>
                  <th>Workers comp</th>
                  <th>Total cost</th>
                </tr>
              </thead>
              <tbody>
                {calculation.sprayFoamSubcontractorItems.map((item, index) => (
                  <tr key={item.type || index}>
                    <td>
                      {index === calculation.sprayFoamSubcontractorItems.length - 1 || item.type === "other sub-contractor" ? (
                        <input
                          className="tableInput"
                          type="text"
                          value={item.type}
                          placeholder="other sub-contractor"
                          onChange={(e) => setSprayFoamSubcontractorItem(index, "type", e.target.value)}
                        />
                      ) : (
                        item.type
                      )}
                    </td>
                    <td>
                      <input
                        className="tableInput"
                        type="number" onWheel={handleNumberInputWheel}
                        min="0"
                        step="0.01"
                        value={item.quantity ?? 0}
                        onChange={(e) => setSprayFoamSubcontractorItem(index, "quantity", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="tableInput"
                        type="number" onWheel={handleNumberInputWheel}
                        min="0"
                        step="0.01"
                        value={item.unitPrice ?? 0}
                        onChange={(e) => setSprayFoamSubcontractorItem(index, "unitPrice", e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        value={item.licensed ? "yes" : "no"}
                        onChange={(e) => setSprayFoamSubcontractorItem(index, "licensed", e.target.value === "yes")}
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </td>
                    <td>{money2(item.workersCompCost || 0)}</td>
                    <td>{money2(item.totalCost || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Laborers per day" value={num(calculation.laborersNeededPerDay, 0)} />
          <DetailRow label="Total estimated days" value={num(calculation.estimatedCompletionDays, 0)} />
          <DetailRow label="Labor rate" value="$400 per guy per day" />
          <DetailRow
            label="Total laborers"
            value={`${num(calculation.laborersNeededPerDay, 0)} x ${num(calculation.estimatedCompletionDays, 0)} = ${num(calculation.totalLaborers, 0)}`}
          />
          {calculation.prevailingWageJob ? (
            <>
              <DetailRow label="Prevailing wage hourly rate" value={money2(calculation.prevailingWageHourlyRate)} />
              <DetailRow label="Prevailing wage crew size" value={num(calculation.prevailingWageCrewSize, 0)} />
              <DetailRow label="Prevailing wage hours per day" value={num(calculation.prevailingWageHoursPerDay, 2)} />
              <DetailRow label="Prevailing wage job days" value={num(calculation.prevailingWageJobDays, 0)} />
              <DetailRow label="Prevailing wage labor cost" value={money2(calculation.prevailingWageLaborCost)} />
            </>
          ) : null}
          <DetailRow label="Production squares" value={num(calculation.productionSquares, 2)} />
          <DetailRow label="Estimated labor cost" value={money2(calculation.estimatedLaborCost)} />
          <DetailRow label="Subcontractor cost" value={money2(calculation.subcontractorCost)} />
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
        showLodging
        oneWayMilesLabel="Miles to location"
        onJobSiteAddressChange={(value) => {
          setTravelField("jobSiteAddress", value);
          setField("jobAddress", value);
          setField("sprayFoamMilesToLocation", inputs.oneWayMiles);
        }}
        onOneWayMilesChange={(value) => {
          setTravelField("oneWayMiles", value);
          setField("sprayFoamMilesToLocation", value);
        }}
        onAverageDrivingSpeedChange={(value) => setTravelField("averageDrivingSpeedMph", value)}
        onWorkHoursPerDayChange={(value) => setField("workHoursPerDay", value)}
        onNumberOfJobDaysChange={(value) => {
          setField("numberOfJobDays", value);
          setField("sprayFoamEstimatedCompletionDays", value);
        }}
        onNumberOfDriversChange={(value) => setField("numberOfDrivers", value)}
        onVehicleSelection={setTravelVehicleSelection}
        onAddVehicleSelection={addTravelVehicleSelection}
        onRemoveVehicleSelection={removeTravelVehicleSelection}
        onCalculateDistance={handleCalculateDistance}
        onLodgingNeededChange={(value) => setField("sprayFoamLodgingNeeded", value)}
        onLodgingNameChange={(value) => setField("sprayFoamLodgingName", value)}
        onNightlyLodgingCostChange={(value) => setField("sprayFoamNightlyLodgingCost", value)}
        onLodgingNightsChange={(value) => setField("sprayFoamLodgingNights", value)}
      />

      <OverheadCalculator
        inputs={inputs}
        calculation={calculation}
        onOverheadPercentChange={(value) => setField("overheadPercent", value)}
        onScopeAddersChange={(value) => setField("scopeAdders", value)}
        onMiscCostChange={(value) => setField("miscCost", value)}
        subtitle="Apply an overhead percentage before markup is calculated."
      />

      <Section title="Totals" subtitle="Job cost, markup table, and pricing per square.">
        <div className="detailList">
          <DetailRow label="Foam cost" value={money2(calculation.foamMaterialCost)} />
          <DetailRow label="Total material cost" value={money2(calculation.totalMaterialCost)} />
          <DetailRow label="Detail material cost" value={money2(calculation.totalDetailMaterialCost)} />
          <DetailRow label="Estimated labor cost" value={money2(calculation.estimatedLaborCost)} />
          <DetailRow label="Subcontractor cost" value={money2(calculation.subcontractorCost)} />
          <DetailRow label="Travel cost" value={money2(calculation.travelCost)} />
          <DetailRow label="Overhead cost" value={money2(calculation.overheadCost)} />
          <DetailRow label="Operating cost" value={money2(calculation.operatingCost)} />
          <DetailRow label="Permit fee" value={money2(calculation.permitFee)} />
          <DetailRow label="Production squares" value={num(calculation.productionSquares, 2)} />
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

        <div className="summaryGrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 14 }}>
          <div className="summaryCard">
            <span>Selected bid</span>
            <strong>{money2(calculation.selectedBidAmount)}</strong>
            <p style={{ marginBottom: 0, color: "var(--muted)" }}>
              {num(calculation.selectedMarkupPercent, 0)}% markup · Profit {money2(calculation.selectedProfitDollars)} · {money2(calculation.selectedPricePerSq)} / SQ
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
