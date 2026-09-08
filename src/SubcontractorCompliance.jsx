import { useCallback, useEffect, useMemo, useState } from "react";
import { SUBCONTRACTOR_COI_BUCKET, buildCoiStoragePath, getSubcontractorComplianceStatus, validateSubcontractor } from "./subcontractorCompliance.js";
import "./SubcontractorCompliance.css";

const blankRecord = () => ({ id: crypto.randomUUID(), company_name: "", trade: "", contact_name: "", phone: "", email: "", license_status: "unlicensed", license_number: "", license_expiration_date: "", workers_comp_active: false, workers_comp_expiration_date: "", coi_names_crt_insured: false, coi_storage_path: "", coi_file_name: "", notes: "", is_active: true });
const dateLabel = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString() : "Not provided";

export default function SubcontractorCompliance({ supabase, authUser, readOnly = false }) {
  const [records, setRecords] = useState([]);
  const [draft, setDraft] = useState(blankRecord);
  const [coiFile, setCoiFile] = useState(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from("subcontractors").select("*").order("company_name");
    if (loadError) { setError(loadError.message); return; }
    setRecords(data || []);
  }, [supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);
  const filtered = useMemo(() => records.filter((record) => [record.company_name, record.trade, record.contact_name, record.license_number].join(" ").toLowerCase().includes(search.toLowerCase())), [records, search]);
  const statuses = useMemo(() => records.map((record) => getSubcontractorComplianceStatus(record)), [records]);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const validation = validateSubcontractor(draft);
    if (!validation.valid) { setError(`Complete: ${validation.missing.join(", ")}.`); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      let coiPath = draft.coi_storage_path || "";
      let coiName = draft.coi_file_name || "";
      if (coiFile) {
        coiPath = buildCoiStoragePath(authUser.key, draft.id, coiFile.name);
        const upload = await supabase.storage.from(SUBCONTRACTOR_COI_BUCKET).upload(coiPath, coiFile, { contentType: coiFile.type || "application/pdf", upsert: false });
        if (upload.error) throw upload.error;
        coiName = coiFile.name;
      }
      const payload = { ...draft, coi_storage_path: coiPath, coi_file_name: coiName, coi_uploaded_at: coiFile ? new Date().toISOString() : (draft.coi_uploaded_at || null), updated_by: authUser.key, updated_at: new Date().toISOString() };
      const { error: saveError } = await supabase.from("subcontractors").upsert(payload, { onConflict: "id" });
      if (saveError) throw saveError;
      setMessage(`${draft.company_name} saved.`); setDraft(blankRecord()); setCoiFile(null); await load();
    } catch (saveError) { setError(saveError.message || String(saveError)); }
    finally { setBusy(false); }
  };

  const edit = (record) => { setDraft({ ...blankRecord(), ...record }); setCoiFile(null); document.getElementById("subcontractor-compliance-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const openCoi = async (record) => {
    const { data, error: urlError } = await supabase.storage.from(SUBCONTRACTOR_COI_BUCKET).createSignedUrl(record.coi_storage_path, 300);
    if (urlError) { setError(urlError.message); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return <section className="subcontractorCompliance">
    <div className="subcontractorSummary">
      <span><b>{records.filter((record) => record.is_active).length}</b> Approved vendors</span>
      <span><b>{statuses.filter((status) => status.key === "compliant").length}</b> Compliant</span>
      <span><b>{statuses.filter((status) => status.tone === "warning").length}</b> Expiring within 30 days</span>
      <span><b>{statuses.filter((status) => status.tone === "danger").length}</b> Action required</span>
    </div>
    {message ? <p className="statusMessage proposalSuccess">{message}</p> : null}{error ? <p className="statusMessage dangerMessage">{error}</p> : null}
    {!readOnly ? <div id="subcontractor-compliance-editor" className="subcontractorEditor">
      <div className="sectionHead"><div><h3>{records.some((record) => record.id === draft.id) ? "Edit vendor / subcontractor" : "Add vendor / subcontractor"}</h3><p>Track approval, licensing, workers' compensation, and CRT Roofing's certificate-holder status.</p></div><button type="button" className="secondaryButton" onClick={() => { setDraft(blankRecord()); setCoiFile(null); }}>New vendor / subcontractor</button></div>
      <div className="formGrid">
        <label><span>Company name *</span><input value={draft.company_name} onChange={(e) => update("company_name", e.target.value)} /></label>
        <label><span>Trade / service *</span><input value={draft.trade} onChange={(e) => update("trade", e.target.value)} placeholder="Roofing, HVAC, electrical..." /></label>
        <label><span>Contact name *</span><input value={draft.contact_name} onChange={(e) => update("contact_name", e.target.value)} /></label>
        <label><span>Phone</span><input value={draft.phone} onChange={(e) => update("phone", e.target.value)} /></label>
        <label><span>Email</span><input type="email" value={draft.email} onChange={(e) => update("email", e.target.value)} /></label>
        <label><span>Licensed?</span><select value={draft.license_status} onChange={(e) => update("license_status", e.target.value)}><option value="licensed">Licensed</option><option value="unlicensed">Non-licensed</option></select></label>
        {draft.license_status === "licensed" ? <><label><span>License number *</span><input value={draft.license_number} onChange={(e) => update("license_number", e.target.value)} /></label><label><span>License expiration</span><input type="date" value={draft.license_expiration_date || ""} onChange={(e) => update("license_expiration_date", e.target.value)} /></label></> : null}
        <label><span>Workers' compensation</span><select value={draft.workers_comp_active ? "active" : "inactive"} onChange={(e) => update("workers_comp_active", e.target.value === "active")}><option value="inactive">Inactive / not provided</option><option value="active">Active</option></select></label>
        {draft.workers_comp_active ? <label><span>Workers' comp expiration *</span><input type="date" value={draft.workers_comp_expiration_date || ""} onChange={(e) => update("workers_comp_expiration_date", e.target.value)} /></label> : null}
        <label><span>COI names CRT Roofing as certificate holder / insured?</span><select value={draft.coi_names_crt_insured ? "yes" : "no"} onChange={(e) => update("coi_names_crt_insured", e.target.value === "yes")}><option value="no">No / not confirmed</option><option value="yes">Yes</option></select></label>
        <label><span>Upload COI</span><input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(e) => setCoiFile(e.target.files?.[0] || null)} /></label>
        <label><span>Approved / active?</span><select value={draft.is_active ? "yes" : "no"} onChange={(e) => update("is_active", e.target.value === "yes")}><option value="yes">Approved and active</option><option value="no">Not approved / inactive</option></select></label>
        <label className="subcontractorWide"><span>Notes</span><textarea rows="3" value={draft.notes || ""} onChange={(e) => update("notes", e.target.value)} /></label>
      </div>
      <button type="button" className="primaryButton" disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : records.some((record) => record.id === draft.id) ? "Update vendor" : "Save approved vendor"}</button>
    </div> : null}
    <div className="subcontractorDirectory"><div className="sectionHead"><div><h3>Approved Vendors &amp; Subcontractors</h3><p>{readOnly ? "Use the approved pricing and information contacts below when preparing estimates or proposals." : "Natalia receives non-duplicate reminders as workers' compensation approaches expiration."}</p></div><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company, trade, contact, or license" /></div>
      <div className="savedList">{filtered.map((record) => { const status = getSubcontractorComplianceStatus(record); return <article className={`savedCard subcontractorCard ${status.tone}`} key={record.id}><div><div className="subcontractorBadges"><span className={`statusTag ${status.tone}`}>{status.label}</span><span className="statusTag">{record.license_status === "licensed" ? `Licensed #${record.license_number}` : "Non-licensed"}</span><span className="statusTag">Workers' comp {record.workers_comp_active ? "active" : "inactive"}</span><span className="statusTag">CRT on COI: {record.coi_names_crt_insured ? "Yes" : "No"}</span></div><strong>{record.company_name}</strong><p>{record.trade}</p><div className="subcontractorContact"><span>Pricing &amp; Information Contact</span><strong>{record.contact_name}</strong><div>{record.phone ? <a href={`tel:${record.phone}`}>{record.phone}</a> : <em>No phone provided</em>}{record.email ? <a href={`mailto:${record.email}`}>{record.email}</a> : <em>No email provided</em>}</div></div><p>Workers' comp expiration: {dateLabel(record.workers_comp_expiration_date)}{record.license_status === "licensed" ? ` | License expiration: ${dateLabel(record.license_expiration_date)}` : ""}</p>{record.notes ? <p>{record.notes}</p> : null}</div><div className="savedActions">{!readOnly && record.coi_storage_path ? <button type="button" className="secondaryButton" onClick={() => void openCoi(record)}>Open COI</button> : null}{!readOnly ? <button type="button" className="secondaryButton" onClick={() => edit(record)}>Edit</button> : null}</div></article>; })}{!filtered.length ? <p className="emptyState">No subcontractors match this search.</p> : null}</div>
    </div>
  </section>;
}
