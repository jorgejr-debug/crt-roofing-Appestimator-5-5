import { useState } from "react";
export default function ServiceEstimateWorkspace({ template, workspace }) {
  const { inputs, calculation, setField, setInputs, Section, Field, TravelCalculator, OverheadCalculator, renderEstimatorShellHeader, css, isLoaded, loadError, isLookingUpDistance, travelLookupMessage, googleDebug, setTravelField, setTravelVehicleSelection, addTravelVehicleSelection, removeTravelVehicleSelection, handleCalculateDistance, handleSaveEstimate, handleConvertCurrentEstimateToProposal, handleDownloadEstimatePDF, money2 } = workspace;
  const [busy, setBusy] = useState(false);
  const title = { coating: "Coating Estimate", repair: "Repair / Service Estimate", maintenance: "Maintenance Estimate" }[template];
  const rows = inputs.serviceMaterials || [];
  const updateRow = (id, key, value) => setInputs(current => ({ ...current, serviceMaterials: (current.serviceMaterials || []).map(row => row.id === id ? { ...row, [key]: value } : row) }));
  const run = async action => { if (busy) return; setBusy(true); try { await action(); } finally { setBusy(false); } };
  return <div className="appShell serviceEstimate"><style>{css}</style>
    {renderEstimatorShellHeader({ title, intro: "Enter the agreed scope, quantities and current costs. Labor includes the company payroll burden." })}
    <Section title="Job and scope"><div className="formGrid">
      {[['jobName','Job name'],['customerName','Customer'],['jobAddress','Job address'],['salesperson','Salesperson']].map(([key,label]) => <Field key={key} label={label}><input value={inputs[key] || ''} onChange={event => setField(key,event.target.value)} /></Field>)}
      <Field label="Service scope"><textarea rows={5} value={inputs.serviceScope ?? inputs.maintenanceNotes ?? ''} onChange={event => setField('serviceScope',event.target.value)} placeholder="Describe preparation, products, repairs, service frequency, exclusions and warranty." /></Field>
      <Field label="Roof area (squares)"><input type="number" min="0" step="0.01" value={inputs.fieldSquares || ''} onChange={event => setField('fieldSquares', event.target.value)} /></Field>
    </div></Section>
    <Section title="Materials" subtitle="Use current supplier prices; no prices are assumed.">
      {rows.map(row => <div className="formGrid serviceMaterial" key={row.id}>
        <Field label="Material / coating product"><input value={row.description} onChange={event => updateRow(row.id,'description',event.target.value)} /></Field>
        <Field label="Unit"><input value={row.unit} onChange={event => updateRow(row.id,'unit',event.target.value)} placeholder="gallon, pail, each" /></Field>
        {[['quantity','Quantity'],['unitCost','Unit cost ($)']].map(([key,label]) => <Field key={key} label={label}><input type="number" min="0" step="0.01" value={row[key]} onChange={event => updateRow(row.id,key,event.target.value)} /></Field>)}
        <button type="button" className="secondaryButton" onClick={() => setField('serviceMaterials', rows.filter(item => item.id !== row.id))}>Remove material</button>
      </div>)}
      <button type="button" className="secondaryButton" onClick={() => setField('serviceMaterials', [...rows,{id:crypto.randomUUID(),description:'',unit:'',quantity:'',unitCost:''}])}>Add material</button>
    </Section>
    <Section title="Labor"><div className="formGrid">
      {[['serviceWorkers','Workers'],['serviceHourlyRate','Base hourly wage ($)'],['serviceHoursPerWorker','Hours per worker']].map(([key,label]) => <Field key={key} label={label}><input type="number" min="0" step="0.01" value={inputs[key] || ''} onChange={event => setField(key,event.target.value)} /></Field>)}
    </div><p>Loaded labor: {money2(calculation.laborCost)}</p></Section>
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


    <OverheadCalculator inputs={inputs} calculation={calculation} onOverheadPercentChange={value => setField('overheadPercent',value)} onScopeAddersChange={value => setField('scopeAdders',value)} onMiscCostChange={value => setField('miscCost',value)} />
    <Section title="Pricing"><div className="formGrid"><Field label="Markup"><select value={calculation.selectedMarkupPercent} onChange={event => setField('selectedMarkupPercent',event.target.value)}>{calculation.bidOptions.options.map(option => <option key={option.percent} value={option.percent}>{option.percent}% — {money2(option.bidAmount)}</option>)}</select></Field>
      <p>Materials: {money2(calculation.materialCost)}<br/>Travel: {money2(calculation.totalTravelCost)}<br/>Cost before profit: {money2(calculation.totalCostBeforeProfit)}<br/><strong>Bid: {money2(calculation.selectedBidAmount)}</strong></p>
    </div><div className="actionRow" aria-busy={busy}>
      <button type="button" className="primaryButton" disabled={busy} onClick={() => run(handleSaveEstimate)}>Save estimate</button>
      <button type="button" className="secondaryButton" disabled={busy} onClick={() => run(handleConvertCurrentEstimateToProposal)}>Create proposal</button>
      <button type="button" className="secondaryButton" disabled={busy} onClick={() => run(handleDownloadEstimatePDF)}>Export PDF</button>
    </div></Section>
  </div>;
}
