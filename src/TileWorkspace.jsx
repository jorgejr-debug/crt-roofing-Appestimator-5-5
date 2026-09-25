export default function TileWorkspace({ workspace }) {
  const {
    DetailRow,
    Field,
    OverheadCalculator,
    Section,
    TravelCalculator,
    addTileCustomMaterial,
    addTileLaborSection,
    addTileTearOffSection,
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
    normalizeShingleTearOffSections,
    num,
    removeTileCustomMaterial,
    removeTileLaborSection,
    removeTileTearOffSection,
    removeTravelVehicleSelection,
    renderEstimatorShellHeader,
    renderQuickMeasureReviewPanel,
    setField,
    setInputs,
    setTileLaborSection,
    setTileTearOffSection,
    setTravelField,
    setTravelVehicleSelection,
    toNumber,
    travelLookupMessage,
    updateTileCustomMaterial,
  } = workspace;

    const tileProfile = String(inputs.tileProfile || "flat");
    const tileFastenerSize =
      tileProfile === "custom"
        ? String(inputs.tileFastenersSize || "")
        : tileProfile === "sTile" || tileProfile === "claySTile"
          ? "3\""
          : "2-1/2\"";
    const tileAdjustedTileSquares = Number(calculation?.tileAdjustedTileSquares ?? 0);
    const totalNailsNeededCalculated = tileAdjustedTileSquares * 10 * Math.max(0, toNumber(inputs.tileFastenersNailsPerTile, 1));
    const fastenerNailsPerBox = Math.max(1, toNumber(inputs.tileFastenersNailsPerBox, 400));
    const fastenerBoxesCalculated = totalNailsNeededCalculated > 0 ? Math.ceil(totalNailsNeededCalculated / fastenerNailsPerBox) : 0;

    return (
    <div className="appShell" onFocusCapture={handleSelectZeroOnFocus}>
      <style>{css}</style>
      {renderEstimatorShellHeader({
        title: "Tile Estimate",
        intro: "Tile estimate built in the same layout and workflow as the Shingle screen.",
      })}

      {renderQuickMeasureReviewPanel()}

      <Section title="Job Information" subtitle="Start with the customer and project basics.">
        <div className="formGrid">
          <Field label="Job name">
            <input type="text" value={inputs.jobName} onChange={(e) => setField("jobName", e.target.value)} />
          </Field>
          <Field label="Customer">
            <input type="text" value={inputs.customerName} onChange={(e) => setField("customerName", e.target.value)} />
          </Field>
          <Field label="Job address">
            <input type="text" value={inputs.jobAddress} onChange={(e) => setField("jobAddress", e.target.value)} />
          </Field>
          <Field label="Salesperson">
            <input type="text" value={inputs.salesperson} onChange={(e) => setField("salesperson", e.target.value)} />
          </Field>
          <Field label="City permit fee">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={inputs.cityPermitFee || 0} onChange={(e) => setField("cityPermitFee", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Tile Project Type" subtitle="Choose the type of tile work being estimated.">
        <div className="formGrid">
          <Field label="Project type">
            <select
              value={inputs.tileProjectType || "raiseReset"}
              onChange={(e) =>
                setInputs((current) => ({
                  ...current,
                  tileProjectType: e.target.value,
                  tileOrderReplacementTile: e.target.value === "raiseReset" ? false : true,
                }))
              }
            >
              <option value="raiseReset">Raise & Reset Existing Tile</option>
              <option value="removeInstallNew">Remove Existing Tile & Install New Tile</option>
              <option value="newConstruction">New Construction</option>
            </select>
          </Field>
          <Field label="Tile profile">
            <select
              value={inputs.tileProfile || "flat"}
              onChange={(e) => setField("tileProfile", e.target.value)}
            >
              <option value="flat">Flat Tile</option>
              <option value="sTile">S-Tile</option>
              <option value="lightweight">Lightweight Tile</option>
              <option value="claySTile">Clay S-Tile</option>
              <option value="custom">Custom</option>
            </select>
          </Field>
          {String(inputs.tileProfile || "flat") === "custom" ? (
            <>
              <Field label="Custom fastener name">
                <input type="text" value={inputs.tileFastenersName || ""} onChange={(e) => setField("tileFastenersName", e.target.value)} />
              </Field>
              <Field label="Custom fastener size">
                <input type="text" value={inputs.tileFastenersSize || ""} onChange={(e) => setField("tileFastenersSize", e.target.value)} />
              </Field>
            </>
          ) : null}
        </div>
      </Section>

      <Section title="Manual Roof Measurements" subtitle="Enter the tile takeoff by hand.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
          <div className="formGrid">
            <Field label="Roof squares">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileTotalRoofSquares} onChange={(e) => setField("tileTotalRoofSquares", e.target.value)} />
            </Field>
            <Field label="Valley linear feet">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileValleyLf} onChange={(e) => setField("tileValleyLf", e.target.value)} />
            </Field>
            <Field label="Hip linear feet">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileHipLf} onChange={(e) => setField("tileHipLf", e.target.value)} />
            </Field>
            <Field label="Battens linear feet">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileBattensLf || 0} onChange={(e) => setField("tileBattensLf", e.target.value)} />
            </Field>
            <Field label="Left rake linear feet">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileLeftRakeLf || 0} onChange={(e) => setField("tileLeftRakeLf", e.target.value)} />
            </Field>
            <Field label="Bird stop linear feet (if required)">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileBirdStopLf || 0} onChange={(e) => setField("tileBirdStopLf", e.target.value)} />
            </Field>
            <Field label="Vents count">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileVentsCount} onChange={(e) => setField("tileVentsCount", e.target.value)} />
            </Field>
            <Field label="Chimney count">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileChimneyCount} onChange={(e) => setField("tileChimneyCount", e.target.value)} />
            </Field>
          </div>
          <div className="formGrid">
            <Field label="Waste percentage">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileWastePercent} onChange={(e) => setField("tileWastePercent", e.target.value)} />
            </Field>
            <Field label="Ridge linear feet">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileRidgeLf} onChange={(e) => setField("tileRidgeLf", e.target.value)} />
            </Field>
            <Field label="Drip edge / perimeter linear feet">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileDripEdgeLf} onChange={(e) => setField("tileDripEdgeLf", e.target.value)} />
            </Field>
            <Field label="Right rake linear feet">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileRightRakeLf || 0} onChange={(e) => setField("tileRightRakeLf", e.target.value)} />
            </Field>
            <Field label="Tile raiser linear feet (if required)">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileTileRaiserLf || 0} onChange={(e) => setField("tileTileRaiserLf", e.target.value)} />
            </Field>
            <Field label="Skylights count">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileSkylightsCount} onChange={(e) => setField("tileSkylightsCount", e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="summaryCard" style={{ marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>Roof Jack Penetrations</h3>
          <div className="formGrid" style={{ marginTop: 10 }}>
            <Field label='1-1/2" pipe penetrations'>
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileOneHalfPipePenetrations} onChange={(e) => setField("tileOneHalfPipePenetrations", e.target.value)} />
            </Field>
            <Field label='2" pipe penetrations'>
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileTwoInchPipePenetrations} onChange={(e) => setField("tileTwoInchPipePenetrations", e.target.value)} />
            </Field>
            <Field label='3" pipe penetrations'>
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileThreeInchPipePenetrations} onChange={(e) => setField("tileThreeInchPipePenetrations", e.target.value)} />
            </Field>
            <Field label='4" pipe penetrations'>
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileFourInchPipePenetrations} onChange={(e) => setField("tileFourInchPipePenetrations", e.target.value)} />
            </Field>
            <Field label="Oval pipe penetrations">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileOvalPipePenetrations} onChange={(e) => setField("tileOvalPipePenetrations", e.target.value)} />
            </Field>
            <Field label="Americap quantity">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileAmericapQuantity} onChange={(e) => setField("tileAmericapQuantity", e.target.value)} />
            </Field>
            <Field label="Oval cap quantity">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileOvalCapQuantity} onChange={(e) => setField("tileOvalCapQuantity", e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Manual measurement mode" value="Active" note="Quantities are still editable in the table below." />
          <DetailRow label="Production squares" value={num(calculation.productionSquares, 2)} />
          <DetailRow label="Total roof squares" value={num(calculation.totalSquares, 2)} />
        </div>
      </Section>

      {(inputs.tileProjectType !== "raiseReset" || Boolean(inputs.tileOrderReplacementTile)) ? (
        <Section title="Tile Ordering Verification" subtitle="Verify pallet and roof-load details before finalizing tile quantities.">
          <div
            className="summaryCard"
            style={{
              marginBottom: 14,
              border: "1px solid rgba(220, 38, 38, 0.5)",
              background: "rgba(220, 38, 38, 0.08)",
            }}
          >
            <strong style={{ display: "block", marginBottom: 6, color: "var(--danger)" }}>
              Tile ordering information has not been verified. Material quantities and costs may be inaccurate.
            </strong>
            <p style={{ marginTop: 0, marginBottom: 10 }}>
              IMPORTANT: Tile pallet yields vary by manufacturer and profile. Always verify pallet yield before ordering.
              Tile deliveries commonly include approximately 3% broken material. A 3% broken tile allowance is automatically
              included unless manually adjusted. Roof-load charges are typically separate from delivery charges. Verify both
              costs with the supplier.
            </p>
            <div className="detailList" style={{ marginTop: 12 }}>
              {[
                { key: "tileOrderingVerifiedPalletYield", label: "Verified tile pallet yield with supplier" },
                { key: "tileOrderingVerifiedRoofLoadCost", label: "Verified tile roof-load cost" },
                { key: "tileOrderingVerifiedMaterialDeliveryCost", label: "Verified material delivery cost" },
                { key: "tileOrderingVerifiedColorProfileAvailability", label: "Verified tile color/profile availability" },
                { key: "tileOrderingVerifiedBrokenAllowance", label: "Included 3% broken tile allowance" },
              ].map((item) => (
                <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, padding: "4px 0" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(inputs[item.key])}
                    onChange={(e) => setField(item.key, e.target.checked)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
            {!calculation.tileOrderingChecklistComplete ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(180, 0, 0, 0.12)",
                  color: "#7f1d1d",
                  fontWeight: 700,
                }}
              >
                Tile ordering information has not been verified. Material quantities and costs may be inaccurate.
              </div>
            ) : (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(34, 197, 94, 0.12)",
                  color: "#14532d",
                  fontWeight: 700,
                }}
              >
                Tile ordering checklist complete.
              </div>
            )}
          </div>
        </Section>
      ) : null}

      <Section title="Tile Material Calculations" subtitle="Editable pricing for the tile material stack.">
        {(() => {
          const showReplacementTileControls = inputs.tileProjectType !== "raiseReset" || Boolean(inputs.tileOrderReplacementTile);
          return (
            <>
              <div
                className="summaryCard"
                style={{
                  marginBottom: 14,
                  border: "1px solid rgba(245, 185, 0, 0.55)",
                  background: "rgba(245, 185, 0, 0.08)",
                }}
              >
                <strong style={{ display: "block", marginBottom: 6 }}>
                  Confirm tile pallet yield before finalizing this estimate.
                </strong>
                <p style={{ marginTop: 0, marginBottom: 8 }}>
                  Tile pallet coverage varies by manufacturer, profile, and tile type. Enter the supplier pallet yield so the app can calculate pallets correctly.
                </p>
                {inputs.tileProjectType === "raiseReset" ? (
                  <div className="formGrid" style={{ marginTop: 10 }}>
                    <Field label="Order replacement tile?">
                      <select
                        value={showReplacementTileControls ? "yes" : "no"}
                        onChange={(e) => setField("tileOrderReplacementTile", e.target.value === "yes")}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </Field>
                  </div>
                ) : null}
                {showReplacementTileControls ? (
                  <>
                    <div className="formGrid" style={{ marginTop: 10 }}>
                      <Field label="Tile pallet yield in SQ per pallet">
                        <input
                          type="number" onWheel={handleNumberInputWheel}
                          min="0"
                          step="0.1"
                          value={inputs.tilePalletYieldSqPerPallet || 0}
                          onChange={(e) => setField("tilePalletYieldSqPerPallet", e.target.value)}
                        />
                      </Field>
                      <Field label="Tile waste percentage">
                        <input
                          type="number" onWheel={handleNumberInputWheel}
                          min="0"
                          step="0.1"
                          value={inputs.tileWastePercent}
                          onChange={(e) => setField("tileWastePercent", e.target.value)}
                        />
                      </Field>
                      <Field label="Broken tile allowance percentage">
                        <input
                          type="number" onWheel={handleNumberInputWheel}
                          min="0"
                          step="0.1"
                          value={inputs.tileBrokenTileAllowancePercent || 3}
                          onChange={(e) => setField("tileBrokenTileAllowancePercent", e.target.value)}
                        />
                      </Field>
                    </div>
              <div className="detailList" style={{ marginTop: 12 }}>
                <DetailRow label="Selected tile profile" value={String(inputs.tileProfile || "flat") === "custom" ? "Custom" : String(inputs.tileProfile || "flat") === "claySTile" ? "Clay S-Tile" : String(inputs.tileProfile || "flat") === "lightweight" ? "Lightweight Tile" : String(inputs.tileProfile || "flat") === "sTile" ? "S-Tile" : "Flat Tile"} />
                <DetailRow label="Recommended fastener size" value={tileFastenerSize} />
                <DetailRow label="Total nails needed" value={num(totalNailsNeededCalculated, 0)} />
                <DetailRow label="Boxes needed" value={num(fastenerBoxesCalculated, 0)} />
                <DetailRow label="Roof squares" value={num(calculation.tileTotalRoofSquares, 2)} />
                <DetailRow label="Waste %" value={`${num(calculation.tileWastePercent, 1)}%`} />
                <DetailRow label="Broken tile allowance %" value={`${num(calculation.tileBrokenTileAllowancePercent, 1)}%`} note="Default broken tile allowance is 3% because tile deliveries commonly include broken pieces. Verify with supplier and job conditions." />
                      <DetailRow label="Adjusted tile squares" value={num(calculation.tileAdjustedTileSquares, 2)} />
                      <DetailRow label="Tile pallet yield" value={num(calculation.tilePalletYieldSqPerPallet, 2)} />
                      <DetailRow label="Tile pallets needed" value={num(calculation.tilePalletsNeeded, 0)} />
                      <DetailRow label="Material delivery" value={money2(calculation.materialDeliveryCharge || 0)} />
                      <DetailRow label="Roof load cost" value={money2(calculation.tileRoofLoadCost || 0)} />
                    </div>
                    <div className="summaryCard" style={{ marginTop: 14 }}>
                      <h3 style={{ marginTop: 0 }}>Tile Underlayment</h3>
                      <div className="formGrid">
                        <Field label="Underlayment type">
                          <select
                            value={inputs.tileUnderlaymentType || "syntheticTitanium50"}
                            onChange={(e) =>
                              setInputs((current) => ({
                                ...current,
                                tileUnderlaymentType: e.target.value,
                                tileUnderlaymentCost: e.target.value === "felt30" ? 30 : 180,
                              }))
                            }
                          >
                            <option value="syntheticTitanium50">Synthetic Titanium-50 Felt</option>
                            <option value="felt30">30# Felt</option>
                          </select>
                        </Field>
                      </div>
                      <div className="detailList" style={{ marginTop: 12 }}>
                        <DetailRow label="Selected underlayment type" value={calculation.tileUnderlaymentType === "felt30" ? "30# Felt" : "Synthetic Titanium-50 Felt"} />
                        <DetailRow label="Coverage per roll" value={`${num(calculation.tileUnderlaymentCoverageSqPerRoll, 0)} SQ / roll`} />
                        <DetailRow label="Rolls needed" value={num(calculation.tileUnderlaymentRollsCalculated, 0)} />
                        <DetailRow
                          label="Unit cost"
                          value={money2(calculation.materialItems.find((item) => item.key === "tileUnderlayment")?.unitPrice || 0)}
                        />
                        <DetailRow
                          label="Total cost"
                          value={money2(calculation.materialItems.find((item) => item.key === "tileUnderlayment")?.amount || 0)}
                        />
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </>
          );
        })()}
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
                  { title: "Main Roofing Materials", keys: ["fieldTile", "tileUnderlayment", "tileUnderlayment30", "battensLath", "flatTileNails", "sTileNails"] },
                  { title: "Metal / Edge", keys: ["valleyMetal", "flashingMetal", "ridgeHipMaterial"] },
                  {
                    title: "Roof Jacks / Accessories",
                    keys: [
                      "mortarMix",
                      "tileOneHalfBaseJack",
                      "tileOneHalfRoofJack",
                      "tileTwoInchBaseJack",
                      "tileTwoInchRoofJack",
                      "tileThreeInchBaseJack",
                      "tileThreeInchRoofJack",
                      "tileFourInchBaseJack",
                      "tileFourInchRoofJack",
                      "tileOvalBaseJack",
                      "tileOvalRoofJack",
                      "tileAmericap",
                      "tileOvalCap",
                      "ohaginVents",
                      "dormerVents",
                    ],
                  },
                  { title: "Delivery Charges", keys: ["materialDeliveryCharge", "tileRoofLoadCost"] },
                  { title: "Wood / Misc", keys: ["cdxPlywood", "fuelSurcharge"] },
                ];
                const itemsByKey = new Map(calculation.materialItems.map((item) => [item.key, item]));
                const quantityKeyMap = {
                  fieldTile: "tileFieldTileQuantity",
                  tileUnderlayment: "tileUnderlaymentQuantityManual",
                  tileUnderlayment30: "tileUnderlayment30QuantityManual",
                  battensLath: "tileBattensQuantityManual",
                  flatTileNails: "tileFlatTileNailsQuantityManual",
                  sTileNails: "tileSTileNailsQuantityManual",
                  valleyMetal: "tileValleyMetalQuantityManual",
                  flashingMetal: "tileDripEdgeQuantityManual",
                  ridgeHipMaterial: "tileRidgeHipQuantity",
                  mortarMix: "tileMortarMixQuantityManual",
                  ohaginVents: "tileOHaginVentsQuantity",
                  dormerVents: "tileDormerVentsQuantity",
                  cdxPlywood: "tileCDXPlywoodQuantity",
                  materialDeliveryCharge: "tileMaterialDeliveryChargeQuantity",
                  tileRoofLoadCost: "tileRoofLoadCostQuantity",
                  fuelSurcharge: "tileFuelSurchargeQuantity",
                };
                const costKeyMap = {
                  fieldTile: "tileFieldTileCost",
                  tileUnderlayment: "tileUnderlaymentCost",
                  tileUnderlayment30: "tileUnderlayment30Cost",
                  battensLath: "tileBattensCost",
                  flatTileNails: "tileFlatTileNailsCost",
                  sTileNails: "tileSTileNailsCost",
                  valleyMetal: "tileValleyMetalCost",
                  flashingMetal: "tileFlashingMetalCost",
                  ridgeHipMaterial: "tileRidgeHipCost",
                  mortarMix: "tileMortarMixCost",
                  tileOneHalfBaseJack: "tileOneHalfBaseJackCost",
                  tileOneHalfRoofJack: "tileOneHalfRoofJackCost",
                  tileTwoInchBaseJack: "tileTwoInchBaseJackCost",
                  tileTwoInchRoofJack: "tileTwoInchRoofJackCost",
                  tileThreeInchBaseJack: "tileThreeInchBaseJackCost",
                  tileThreeInchRoofJack: "tileThreeInchRoofJackCost",
                  tileFourInchBaseJack: "tileFourInchBaseJackCost",
                  tileFourInchRoofJack: "tileFourInchRoofJackCost",
                  tileOvalBaseJack: "tileOvalBaseJackCost",
                  tileOvalRoofJack: "tileOvalRoofJackCost",
                  tileAmericap: "tileAmericapCost",
                  tileOvalCap: "tileOvalCapCost",
                  ohaginVents: "tileOHaginVentsCost",
                  dormerVents: "tileDormerVentsCost",
                  cdxPlywood: "tileCDXPlywoodCost",
                  materialDeliveryCharge: "tileMaterialDeliveryCharge",
                  tileRoofLoadCost: "tileRoofLoadCost",
                  fuelSurcharge: "tileFuelSurcharge",
                };
                const lockedQuantityKeys = new Set([
                  "tileOneHalfBaseJack",
                  "tileOneHalfRoofJack",
                  "tileTwoInchBaseJack",
                  "tileTwoInchRoofJack",
                  "tileThreeInchBaseJack",
                  "tileThreeInchRoofJack",
                  "tileFourInchBaseJack",
                  "tileFourInchRoofJack",
                  "tileOvalBaseJack",
                  "tileOvalRoofJack",
                  "tileAmericap",
                  "tileOvalCap",
                ]);
                return groupDefinitions.flatMap((group) => [
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
                        <td>
                          <strong>{item.label}</strong>
                          {item.notes ? <div className="smallNote" style={{ marginTop: 4 }}>{item.notes}</div> : null}
                        </td>
                        <td>
                          <input
                            type="number" onWheel={handleNumberInputWheel}
                            min="0"
                            step="0.01"
                            readOnly={lockedQuantityKeys.has(item.key)}
                            value={
                              item.key === "fieldTile"
                                ? (inputs.tileFieldTileQuantityManual === "" ? item.quantity : inputs.tileFieldTileQuantityManual)
                                : item.key === "mortarMix"
                                  ? (inputs.tileMortarMixQuantityManual === "" ? item.quantity : inputs.tileMortarMixQuantityManual)
                                  : item.key === "tileUnderlayment"
                                    ? (inputs.tileUnderlaymentQuantityManual === "" ? item.quantity : inputs.tileUnderlaymentQuantityManual)
                                    : item.key === "battensLath"
                                      ? (inputs.tileBattensQuantityManual === "" ? item.quantity : inputs.tileBattensQuantityManual)
                                      : item.key === "valleyMetal"
                                        ? (inputs.tileValleyMetalQuantityManual === "" ? item.quantity : inputs.tileValleyMetalQuantityManual)
                                    : item.key === "flashingMetal"
                                      ? (inputs.tileDripEdgeQuantityManual === "" ? item.quantity : inputs.tileDripEdgeQuantityManual)
                                      : item.quantity
                            }
                            onChange={(e) => {
                              if (lockedQuantityKeys.has(item.key)) {
                                return;
                              }
                              if (item.key === "fieldTile") {
                                setField("tileFieldTileQuantityManual", e.target.value);
                                return;
                              }
                              if (item.key === "mortarMix") {
                                setField("tileMortarMixQuantityManual", e.target.value);
                                return;
                              }
                              if (item.key === "tileUnderlayment") {
                                setField("tileUnderlaymentQuantityManual", e.target.value);
                                return;
                              }
                              if (item.key === "battensLath") {
                                setField("tileBattensQuantityManual", e.target.value);
                                return;
                              }
                              if (item.key === "flatTileNails") {
                                setField("tileFlatTileNailsQuantityManual", e.target.value);
                                return;
                              }
                              if (item.key === "sTileNails") {
                                setField("tileSTileNailsQuantityManual", e.target.value);
                                return;
                              }
                              if (item.key === "valleyMetal") {
                                setField("tileValleyMetalQuantityManual", e.target.value);
                                return;
                              }
                              if (item.key === "flashingMetal") {
                                setField("tileDripEdgeQuantityManual", e.target.value);
                                return;
                              }
                              if (item.key === "ohaginVents") {
                                setField("tileOHaginVentsQuantity", e.target.value);
                                return;
                              }
                              if (item.key === "dormerVents") {
                                setField("tileDormerVentsQuantity", e.target.value);
                                return;
                              }
                              const mappedKey = quantityKeyMap[item.key];
                              if (mappedKey) setField(mappedKey, e.target.value);
                            }}
                          />
                        </td>
                        <td>{item.unit}</td>
                        <td>
                          <input
                            type="number" onWheel={handleNumberInputWheel}
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const mappedKey = costKeyMap[item.key];
                              if (mappedKey) setField(mappedKey, e.target.value);
                            }}
                          />
                        </td>
                        <td>{money2(item.amount)}</td>
                      </tr>
                    )),
                ]);
              })()}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="actionRow">
            <button type="button" className="secondaryButton" onClick={addTileCustomMaterial}>
              + Custom Material Order
            </button>
            <em style={{ marginLeft: 8 }}>Add any tile material that is not already listed.</em>
          </div>
          {Array.isArray(inputs.tileCustomMaterials) && inputs.tileCustomMaterials.length ? (
            <div className="tableWrap" style={{ marginTop: 12 }}>
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Price per piece</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {inputs.tileCustomMaterials.map((mat, idx) => {
                    const quantity = Math.max(0, toNumber(mat.quantity, 0));
                    const unitPrice = Math.max(0, toNumber(mat.unitPrice, 0));
                    return (
                      <tr key={mat.id || idx}>
                        <td>
                          <input type="text" value={mat.name} onChange={(e) => updateTileCustomMaterial(idx, "name", e.target.value)} placeholder="Material name" />
                        </td>
                        <td>
                          <input
                            type="number" onWheel={handleNumberInputWheel}
                            min="0"
                            step="0.01"
                            value={quantity}
                            onChange={(e) => updateTileCustomMaterial(idx, "quantity", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number" onWheel={handleNumberInputWheel}
                            min="0"
                            step="0.01"
                            value={unitPrice}
                            onChange={(e) => updateTileCustomMaterial(idx, "unitPrice", e.target.value)}
                          />
                        </td>
                        <td>{money2(quantity * unitPrice)}</td>
                        <td>
                          <button type="button" className="dangerButton" onClick={() => removeTileCustomMaterial(idx)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Total material cost" value={money2(calculation.materialCost)} />
        </div>
      </Section>

      <Section title="Tear-Off / Disposal" subtitle="How many roof sections need to be torn off?">
        <div className="actionRow">
          <button type="button" className="secondaryButton" onClick={addTileTearOffSection}>
            Add section
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => removeTileTearOffSection((normalizeShingleTearOffSections(inputs.tileTearOffSections).length || 1) - 1)}
          >
            Remove section
          </button>
        </div>
        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Number of tear-off sections" value={num(calculation.tileTearOffSections?.length || 0, 0)} />
          <DetailRow label="Total Tear-Off / Disposal Cost" value={money2(calculation.tearOffDisposalCost)} />
        </div>
        <div className="detailList" style={{ marginTop: 14 }}>
          {normalizeShingleTearOffSections(inputs.tileTearOffSections).map((section, index) => {
            const sectionTotal = calculation.tileTearOffSections?.[index]?.sectionTearOffTotal ?? 0;
            return (
              <div className="summaryCard" key={section.id || index}>
                <h3 style={{ marginTop: 0 }}>Section {index + 1}</h3>
                <div className="formGrid">
                  <Field label="Section name/label">
                    <input type="text" value={section.label} onChange={(e) => setTileTearOffSection(index, "label", e.target.value)} />
                  </Field>
                  <Field label="Squares for this section">
                    <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={section.squares} onChange={(e) => setTileTearOffSection(index, "squares", e.target.value)} />
                  </Field>
                  <Field label="Number of existing layers">
                    <input type="number" onWheel={handleNumberInputWheel} min="1" step="1" value={section.layers} onChange={(e) => setTileTearOffSection(index, "layers", e.target.value)} />
                  </Field>
                  <Field label="Tear-off cost per square">
                    <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={section.tearOffCostPerSquare} onChange={(e) => setTileTearOffSection(index, "tearOffCostPerSquare", e.target.value)} />
                  </Field>
                  <Field label="Disposal fee / dump fee">
                    <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={section.disposalFee} onChange={(e) => setTileTearOffSection(index, "disposalFee", e.target.value)} />
                  </Field>
                  <Field label="Dry rot allowance">
                    <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={section.dryRotAllowance} onChange={(e) => setTileTearOffSection(index, "dryRotAllowance", e.target.value)} />
                  </Field>
                </div>
                <div className="detailList" style={{ marginTop: 12 }}>
                  <DetailRow label="Section tear-off total" value={money2(sectionTotal)} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Labor" subtitle="Choose who performs the labor and calculate the labor cost from here.">
        <div className="formGrid">
          <Field label="Is this project going to be performed in-house or sub-contracted?">
            <select value={inputs.tileLaborType} onChange={(e) => setField("tileLaborType", e.target.value)}>
              <option value="inHouse">In-house</option>
              <option value="subcontracted">Sub-contracted</option>
            </select>
          </Field>
        </div>

        {String(inputs.tileLaborType || "inHouse") === "inHouse" ? (
          <>
            <div className="formGrid" style={{ marginTop: 14 }}>
              <Field label="Laborers per day">
                <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileLaborersPerDay} onChange={(e) => setField("tileLaborersPerDay", e.target.value)} />
              </Field>
              <Field label="Total days on job">
                <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={inputs.tileTotalDaysOnJob} onChange={(e) => setField("tileTotalDaysOnJob", e.target.value)} />
              </Field>
              <Field label="Labor hourly rate">
                <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={inputs.tileLaborHourlyRate} onChange={(e) => setField("tileLaborHourlyRate", e.target.value)} />
                <div className="fieldHelp">Default rate: $50.00/hour (includes payroll taxes and workers' compensation).</div>
              </Field>
              <Field label="Hours per day">
                <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={inputs.tileHoursPerDay} onChange={(e) => setField("tileHoursPerDay", e.target.value)} />
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
                <select value={String(inputs.tileSubcontractorLicensed ? "yes" : "no")} onChange={(e) => setField("tileSubcontractorLicensed", e.target.value === "yes")}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Does subcontractor carry workers comp?">
                <select value={String(inputs.tileSubcontractorWorkersComp ? "yes" : "no")} onChange={(e) => setField("tileSubcontractorWorkersComp", e.target.value === "yes")}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
            </div>
            <div className="actionRow" style={{ marginTop: 12 }}>
              <button type="button" className="secondaryButton" onClick={addTileLaborSection}>
                Add subcontractor section
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => removeTileLaborSection((normalizeShingleLaborSections(inputs.tileSubcontractorSections).length || 1) - 1)}
              >
                Remove section
              </button>
            </div>
            <div className="detailList" style={{ marginTop: 14 }}>
              {normalizeShingleLaborSections(inputs.tileSubcontractorSections).map((section, index) => {
                const sectionInstallTotal = calculation.tileSubcontractorSections?.[index]?.sectionInstallTotal ?? 0;
                return (
                  <div className="summaryCard" key={section.id || index}>
                    <h3 style={{ marginTop: 0 }}>Subcontractor Section {index + 1}</h3>
                    <div className="formGrid">
                      <Field label="Section name">
                        <input type="text" value={section.label} onChange={(e) => setTileLaborSection(index, "label", e.target.value)} />
                      </Field>
                      <Field label="Install squares">
                        <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={section.installSquares} onChange={(e) => setTileLaborSection(index, "installSquares", e.target.value)} />
                      </Field>
                      <Field label="Cost per install SQ">
                        <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={section.costPerInstallSq} onChange={(e) => setTileLaborSection(index, "costPerInstallSq", e.target.value)} />
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
              <DetailRow label="Subcontractor install subtotal" value={money2(calculation.tileSubcontractorInstallSubtotal || 0)} />
              <DetailRow label="Workers comp / risk add-on" value={money2(calculation.tileWorkersCompRiskAddOn || 0)} />
              <DetailRow label="Total subcontractor labor cost" value={money2(calculation.tileTotalSubcontractorLaborCost || 0)} />
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
        oneWayMilesLabel="Miles to location"
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
          <DetailRow label="Tear-off / disposal cost" value={money2(calculation.tearOffDisposalCost)} />
          <DetailRow label="Travel cost" value={money2(calculation.travelCost)} />
          <DetailRow label="City permit fee" value={money2(calculation.cityPermitFee)} />
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
            value={inputs.tileCustomBidAmount}
            onChange={(e) => setField("tileCustomBidAmount", e.target.value)}
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

