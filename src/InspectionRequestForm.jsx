import { useState } from "react";
import { validateQuickLead } from "./crmLeadWorkflow.js";

const blank = () => ({ id: crypto.randomUUID(), contactName: "", companyName: "", phone: "", email: "", propertyAddress: "", bestTimeToCall: "", urgency: "Normal", description: "", leadSource: "Phone Call / Office", roofingServiceNeeded: "Roof inspection" });
export default function InspectionRequestForm({ userId, onSubmit, onCreated }) {
  const storageKey = `crt.inspection-request.${userId}`;
  const [draft, setDraft] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey)); return saved?.id ? { ...blank(), ...saved } : blank(); } catch { return blank(); }
  });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [draftNotice, setDraftNotice] = useState("");
  const change = (field, value) => {
    const next = { ...draft, [field]: value }; setDraft(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setDraftNotice("Draft saved on this device."); }
    catch { setDraftNotice("Device storage is unavailable. Keep this screen open until the request is sent."); }
  };
  const submit = async (event) => {
    event.preventDefault(); if (busy) return;
    const validation = validateQuickLead(draft);
    if (!validation.valid) { setError(validation.errors.join(" ")); return; }
    if (navigator.onLine === false) { setError("You are offline. Your draft is preserved. Reconnect and send again."); return; }
    setBusy(true); setError("");
    try {
      const task = await onSubmit(draft);
      if (!task?.id) { setError("The request was not confirmed. Review the message above, then retry. Your draft is preserved."); return; }
      try { localStorage.removeItem(storageKey); } catch { /* Request already confirmed. */ }
      setDraft(blank()); setDraftNotice("");
      await onCreated(task);
    } catch (error) { setError(`Could not confirm the request. Your draft is preserved. ${error.message || "Check your connection and retry."}`); }
    finally { setBusy(false); }
  };
  return <section className="panel inspectionRequestPanel">
    <h2>Submit Inspection Request</h2>
    <p>Send Ivan the customer’s details so he can arrange a roof inspection. Add photos or documents to the task after sending.</p>
    <form className="workHubForm" onSubmit={submit}>
      <fieldset disabled={busy} className="inspectionRequestFields">
        <label><span>Contact name or company *</span><input autoComplete="name" value={draft.contactName} onChange={e => change("contactName", e.target.value)} required /></label>
        <div className="workHubFormRow">
          <label><span>Phone</span><input type="tel" autoComplete="tel" value={draft.phone} onChange={e => change("phone", e.target.value)} /></label>
          <label><span>Email</span><input type="email" autoComplete="email" value={draft.email} onChange={e => change("email", e.target.value)} /></label>
        </div>
        <label><span>Property address</span><input autoComplete="street-address" value={draft.propertyAddress} onChange={e => change("propertyAddress", e.target.value)} /></label>
        <small>Provide at least a phone number, email, or property address.</small>
        <label><span>Best time to call</span><input value={draft.bestTimeToCall} onChange={e => change("bestTimeToCall", e.target.value)} /></label>
        <label><span>Urgency</span><select value={draft.urgency} onChange={e => change("urgency", e.target.value)}><option>Normal</option><option>High</option><option>Urgent</option></select></label>
        <label><span>Inspection notes</span><textarea rows="4" value={draft.description} onChange={e => change("description", e.target.value)} /></label>
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
      <small role="status">{draftNotice}</small>
      <div className="inspectionRequestSubmit"><button type="submit" className="primaryButton" disabled={busy}>{busy ? "Sending inspection request…" : "Send Inspection Request to Ivan"}</button></div>
    </form>
  </section>;
}
