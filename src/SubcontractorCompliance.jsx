import { useCallback, useEffect, useMemo, useState } from "react";
import { SUBCONTRACTOR_COI_BUCKET, buildCoiStoragePath, getSubcontractorComplianceStatus, normalizeSubcontractorPayload, validateSubcontractor } from "./subcontractorCompliance.js";
import FileDropZone from "./FileDropZone.jsx";
import "./SubcontractorCompliance.css";

const blankRecord = () => ({ id: crypto.randomUUID(), company_name: "", trade: "", contact_name: "", phone: "", email: "", license_status: "unlicensed", license_number: "", license_expiration_date: "", workers_comp_active: false, workers_comp_expiration_date: "", coi_names_crt_insured: false, coi_storage_path: "", coi_file_name: "", notes: "", is_active: true });
const dateLabel = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString() : "Not provided";

export default function SubcontractorCompliance({ supabase, authUser, readOnly = false }) {
  const [records, setRecords] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [draft, setDraft] = useState(blankRecord);
  const [coiFiles, setCoiFiles] = useState([]);
  const [invalidFields, setInvalidFields] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [recordResult, documentResult] = await Promise.all([
      supabase.from("subcontractors").select("*").order("company_name"),
      supabase.from("subcontractor_documents").select("*").order("created_at", { ascending: false }),
    ]);
    const loadError = recordResult.error || documentResult.error;
    if (loadError) { setError(loadError.message); return; }
    setRecords(recordResult.data || []); setDocuments(documentResult.data || []);
  }, [supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);
  const filtered = useMemo(() => records.filter((record) => [record.company_name, record.trade, record.contact_name, record.license_number].join(" ").toLowerCase().includes(search.toLowerCase())), [records, search]);
  const statuses = useMemo(() => records.map((record) => getSubcontractorComplianceStatus(record)), [records]);
  const update = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setInvalidFields((current) => current.filter((item) => item !== key)); };
  const addCoiFiles = (files) => setCoiFiles((current) => [...current, ...files.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified))]);

  const save = async () => {
    const validation = validateSubcontractor(draft);
    if (!validation.valid) {
      const fieldByLabel = { "Company name": "company_name", "Trade / service": "trade", "Contact name": "contact_name", "License number": "license_number", "Workers' compensation expiration date": "workers_comp_expiration_date" };
      const fields = validation.missing.map((label) => fieldByLabel[label]).filter(Boolean);
      setInvalidFields(fields);
      setError(validation.missing[0] === "Trade / service" ? "Enter the subcontractor’s trade or service." : `Complete these required fields: ${validation.missing.join(", ")}.`);
      window.setTimeout(() => document.getElementById(`subcontractor-${fields[0]}`)?.focus(), 0);
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      let coiPath = draft.coi_storage_path || "";
      let coiName = draft.coi_file_name || "";
      const uploadedDocuments = [];
      for (const file of coiFiles) {
        const path = buildCoiStoragePath(authUser.key, draft.id, file.name);
        const upload = await supabase.storage.from(SUBCONTRACTOR_COI_BUCKET).upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
        if (upload.error) throw upload.error;
        uploadedDocuments.push({ subcontractor_id: draft.id, category: "coi", file_name: file.name, storage_path: path, content_type: file.type || "application/pdf", file_size: file.size, uploaded_by: authUser.key });
      }
      if (uploadedDocuments.length) {
        coiPath = uploadedDocuments[0].storage_path;
        coiName = uploadedDocuments[0].file_name;
      }
      const payload = normalizeSubcontractorPayload({ ...draft, coi_storage_path: coiPath, coi_file_name: coiName, coi_uploaded_at: uploadedDocuments.length ? new Date().toISOString() : (draft.coi_uploaded_at || null), updated_by: authUser.key, updated_at: new Date().toISOString() });
      const { error: saveError } = await supabase.from("subcontractors").upsert(payload, { onConflict: "id" });
      if (saveError) throw saveError;
      if (uploadedDocuments.length) {
        const { error: documentError } = await supabase.from("subcontractor_documents").insert(uploadedDocuments);
        if (documentError) throw documentError;
      }
      setMessage(`${draft.company_name} saved${uploadedDocuments.length ? ` with ${uploadedDocuments.length} document${uploadedDocuments.length === 1 ? "" : "s"}` : ""}.`); setDraft(blankRecord()); setCoiFiles([]); setInvalidFields([]); await load();
    } catch (saveError) { setError(saveError.message || String(saveError)); }
    finally { setBusy(false); }
  };

  const edit = (record) => { setDraft({ ...blankRecord(), ...record }); setCoiFiles([]); setInvalidFields([]); document.getElementById("subcontractor-compliance-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const openCoi = async (path) => {
    const { data, error: urlError } = await supabase.storage.from(SUBCONTRACTOR_COI_BUCKET).createSignedUrl(path, 300);
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
      <div className="sectionHead"><div><h3>{records.some((record) => record.id === draft.id) ? "Edit vendor / subcontractor" : "Add vendor / subcontractor"}</h3><p>Track approval, licensing, workers' compensation, and CRT Roofing's certificate-holder status.</p></div><button type="button" className="secondaryButton" onClick={() => { setDraft(blankRecord()); setCoiFiles([]); setInvalidFields([]); }}>New vendor / subcontractor</button></div>
      <div className="formGrid">
        <label><span>Company name *</span><input id="subcontractor-company_name" className={invalidFields.includes("company_name") ? "fieldInvalid" : ""} aria-invalid={invalidFields.includes("company_name")} value={draft.company_name} onChange={(e) => update("company_name", e.target.value)} /></label>
        <label><span>Trade / service *</span><input id="subcontractor-trade" className={invalidFields.includes("trade") ? "fieldInvalid" : ""} aria-invalid={invalidFields.includes("trade")} value={draft.trade} onChange={(e) => update("trade", e.target.value)} placeholder="Example: Hauling, roofing, HVAC, electrical" /></label>
        <label><span>Contact name *</span><input id="subcontractor-contact_name" className={invalidFields.includes("contact_name") ? "fieldInvalid" : ""} aria-invalid={invalidFields.includes("contact_name")} value={draft.contact_name} onChange={(e) => update("contact_name", e.target.value)} /></label>
        <label><span>Phone</span><input value={draft.phone} onChange={(e) => update("phone", e.target.value)} /></label>
        <label><span>Email</span><input type="email" value={draft.email} onChange={(e) => update("email", e.target.value)} /></label>
        <label><span>Licensed?</span><select value={draft.license_status} onChange={(e) => update("license_status", e.target.value)}><option value="licensed">Licensed</option><option value="unlicensed">Non-licensed</option></select></label>
        {draft.license_status === "licensed" ? <><label><span>License number *</span><input id="subcontractor-license_number" className={invalidFields.includes("license_number") ? "fieldInvalid" : ""} aria-invalid={invalidFields.includes("license_number")} value={draft.license_number} onChange={(e) => update("license_number", e.target.value)} /></label><label><span>License expiration</span><input type="date" value={draft.license_expiration_date || ""} onChange={(e) => update("license_expiration_date", e.target.value)} /></label></> : null}
        <label><span>Workers' compensation</span><select value={draft.workers_comp_active ? "active" : "inactive"} onChange={(e) => update("workers_comp_active", e.target.value === "active")}><option value="inactive">Inactive / not provided</option><option value="active">Active</option></select></label>
        {draft.workers_comp_active ? <label><span>Workers' comp expiration *</span><input id="subcontractor-workers_comp_expiration_date" className={invalidFields.includes("workers_comp_expiration_date") ? "fieldInvalid" : ""} aria-invalid={invalidFields.includes("workers_comp_expiration_date")} type="date" value={draft.workers_comp_expiration_date || ""} onChange={(e) => update("workers_comp_expiration_date", e.target.value)} /></label> : null}
        <label><span>COI names CRT Roofing as certificate holder / insured?</span><select value={draft.coi_names_crt_insured ? "yes" : "no"} onChange={(e) => update("coi_names_crt_insured", e.target.value === "yes")}><option value="no">No / not confirmed</option><option value="yes">Yes</option></select></label>
        <div className="subcontractorWide"><span className="fieldLabel">COI and compliance documents</span><FileDropZone accept=".pdf,image/jpeg,image/png,image/webp" label="Choose COI Files" help="PDF, JPG, PNG, or WebP — up to 15 MB each" onFiles={addCoiFiles} disabled={busy} />{coiFiles.length ? <div className="subcontractorPendingFiles">{coiFiles.map((file, index) => <div key={`${file.name}-${file.size}-${file.lastModified}`}><span>{file.name}</span><button type="button" className="secondaryButton" onClick={() => setCoiFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div> : null}</div>
        <label><span>Approved / active?</span><select value={draft.is_active ? "yes" : "no"} onChange={(e) => update("is_active", e.target.value === "yes")}><option value="yes">Approved and active</option><option value="no">Not approved / inactive</option></select></label>
        <label className="subcontractorWide"><span>Notes</span><textarea rows="3" value={draft.notes || ""} onChange={(e) => update("notes", e.target.value)} /></label>
      </div>
      <button type="button" className="primaryButton" disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : records.some((record) => record.id === draft.id) ? "Update vendor" : "Save approved vendor"}</button>
    </div> : null}
    <div className="subcontractorDirectory"><div className="sectionHead"><div><h3>Approved Vendors &amp; Subcontractors</h3><p>{readOnly ? "Use the approved pricing and information contacts below when preparing estimates or proposals." : "Natalia receives non-duplicate reminders as workers' compensation approaches expiration."}</p></div><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company, trade, contact, or license" /></div>
      <div className="savedList">{filtered.map((record) => { const status = getSubcontractorComplianceStatus(record); const recordDocuments = documents.filter((document) => document.subcontractor_id === record.id); return <article className={`savedCard subcontractorCard ${status.tone}`} key={record.id}><div><div className="subcontractorBadges"><span className={`statusTag ${status.tone}`}>{status.label}</span><span className="statusTag">{record.license_status === "licensed" ? `Licensed #${record.license_number}` : "Non-licensed"}</span><span className="statusTag">Workers' comp {record.workers_comp_active ? "active" : "inactive"}</span><span className="statusTag">CRT on COI: {record.coi_names_crt_insured ? "Yes" : "No"}</span></div><strong>{record.company_name}</strong><p>{record.trade}</p><div className="subcontractorContact"><span>Pricing &amp; Information Contact</span><strong>{record.contact_name}</strong><div>{record.phone ? <a href={`tel:${record.phone}`}>{record.phone}</a> : <em>No phone provided</em>}{record.email ? <a href={`mailto:${record.email}`}>{record.email}</a> : <em>No email provided</em>}</div></div><p>Workers' comp expiration: {dateLabel(record.workers_comp_expiration_date)}{record.license_status === "licensed" ? ` | License expiration: ${dateLabel(record.license_expiration_date)}` : ""}</p>{record.notes ? <p>{record.notes}</p> : null}</div><div className="savedActions">{!readOnly && recordDocuments.map((document) => <button type="button" className="secondaryButton" key={document.id} onClick={() => void openCoi(document.storage_path)}>Open {document.file_name}</button>)}{!readOnly && !recordDocuments.length && record.coi_storage_path ? <button type="button" className="secondaryButton" onClick={() => void openCoi(record.coi_storage_path)}>Open {record.coi_file_name || "COI"}</button> : null}{!readOnly ? <button type="button" className="secondaryButton" onClick={() => edit(record)}>Edit</button> : null}</div></article>; })}{!filtered.length ? <p className="emptyState">No subcontractors match this search.</p> : null}</div>
    </div>
  </section>;
}
