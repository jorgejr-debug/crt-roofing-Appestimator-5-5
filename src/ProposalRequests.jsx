import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PROPOSAL_JOB_TYPES,
  PROPOSAL_REQUEST_PRIORITIES,
  SALES_APPROVAL_ACKNOWLEDGEMENT,
  buildProductionGateReasons,
  calculateProposalMetrics,
  getSlaDisplay,
  validateProposalRequest,
} from "./proposalRequestWorkflow.js";
import { downloadProposalRequestPdf, downloadProposalRequestZip } from "./proposalRequestExport.js";
import {
  PROPOSAL_REQUEST_FILE_ACCEPT,
  buildProposalRequestAttachmentPath,
  proposalRequestAttachmentCategory,
  validateProposalRequestAttachment,
} from "./proposalRequestAttachments.js";
import "./ProposalRequests.css";

const textFields = [
  ["Customer / Job Information", [
    ["customer_name", "Customer name", true], ["property_name", "Property / job name", true], ["service_address", "Property service address", true],
    ["billing_information", "Billing information", true, "textarea"], ["project_contact_first_name", "Project contact first name", true],
    ["project_contact_last_name", "Project contact last name", true], ["project_contact_phone", "Project contact phone number", true],
    ["project_contact_email", "Project contact email", true], ["customer_contact", "Additional contact notes"], ["existing_lead_job_id", "Existing lead / job ID"],
  ]],
  ["Scope Information", [
    ["scope_of_work", "Detailed scope of work", true, "textarea"], ["roof_areas", "Roof areas / sections", true, "textarea"],
    ["roofing_system", "Roofing system", true], ["work_type", "Tear-off, overlay, repair, SPF, TPO, tile, coating, etc.", true],
    ["measurements", "Scope square footage / squares", true], ["roof_measurement_notes", "Roof measurement notes", true, "textarea"],
    ["total_linear_feet", "Total linear feet"], ["material_specifications", "Material / system specifications", true, "textarea"],
    ["existing_layers", "Number of existing layers"], ["special_conditions", "Special conditions", false, "textarea"],
    ["exclusions", "Exclusions", false, "textarea"], ["allowances", "Allowances", false, "textarea"], ["alternates", "Alternates / optional sections", false, "textarea"],
  ]],
  ["Roof & Property Details", [
    ["property_type", "Property type", true, "select", ["Commercial", "Residential", "Multifamily"]],
    ["story_count", "Building height", true, "select", ["1 story", "2 stories", "3+ stories"]],
    ["construction_type", "Construction condition", true, "select", ["Existing roof", "New construction"]], ["warranty_requirements", "Requested warranty"],
    ["tear_off_details", "Tear-off required? Layers and square footage", false, "textarea"],
    ["parapet_wall_measurements", "Parapet wall measurements", false, "textarea"],
    ["ac_work_details", "A/C work — curbs, pan metals, disconnect/reconnect", false, "textarea"],
    ["plywood_fascia_notes", "Plywood or fascia replacement notes", false, "textarea"],
    ["detail_component_notes", "Edge metal, T-tops, drains, and scuppers", false, "textarea"],
    ["accessories_needed", "Skylights, chimney caps, vents, whirly birds, or roof hatch", false, "textarea"],
    ["deck_material_requirements", "Metal sheets or dense deck requirements", false, "textarea"],
    ["shingle_selection", "GAF shingle color (shingle projects)"], ["tile_selection", "Tile brand, style, and color (tile projects)"],
    ["warranty_upgrade_options", "Warranty upgrade options", false, "textarea"],
  ]],
  ["Production Assumptions", [
    ["equipment_requirements", "Equipment requirements", false, "textarea"], ["crane_requirements", "Crane requirements"],
    ["hvac_requirements", "HVAC disconnect / reconnect requirements"], ["travel_lodging", "Travel / lodging considerations"],
    ["subcontractor_requirements", "Subcontractors needed? Company/trade if known", false, "textarea"],
    ["roof_access_details", "Roof/property access, ladder, hatch, key, code, or authorization", false, "textarea"],
    ["permit_requirements", "Permits required?", false, "select", ["Unknown", "Yes", "No"]],
    ["weekend_work_availability", "Is weekend work available?", false, "select", ["Unknown", "Yes", "No"]],
    ["overspray_risk_notes", "Overspray or other potential risks", false, "textarea"],
    ["parking_zone_sign_locations", "No Parking / Construction Zone sign locations", false, "textarea"],
    ["production_notes", "Other production notes", false, "textarea"],
  ]],
  ["Pricing / Estimating", [
    ["estimated_material_quantities", "Estimated material quantities", true, "textarea"], ["estimated_labor_assumptions", "Estimated labor assumptions", true, "textarea"],
    ["pricing_notes", "Pricing notes", false, "textarea"], ["margin_markup_assumptions", "Margin / markup assumptions"],
    ["payment_deposit_terms", "Payment / deposit terms", false, "textarea"],
  ]],
  ["Salesperson Notes", [
    ["customer_requests", "Specific customer requests", false, "textarea"], ["verbal_commitments", "Anything verbally discussed or promised", false, "textarea"],
    ["salesperson_notes", "Other important notes", false, "textarea"],
  ]],
];

const blankDraft = (userId = "") => ({
  salesperson_id: userId, assigned_estimator_id: "", priority: "normal", job_type: "standard_roof", existing_lead_job_id: "",
  customer_name: "", property_name: "", service_address: "", billing_information: "", customer_contact: "", project_contact_first_name: "",
  project_contact_last_name: "", project_contact_phone: "", project_contact_email: "", scope_of_work: "", roof_areas: "",
  roofing_system: "", work_type: "", measurements: "", roof_measurement_notes: "", total_linear_feet: "", material_specifications: "", existing_layers: "", special_conditions: "", exclusions: "",
  allowances: "", alternates: "", estimated_crew_size: "", estimated_working_days: "", equipment_requirements: "", crane_requirements: "",
  hvac_requirements: "", travel_lodging: "", production_notes: "", property_type: "", story_count: "", construction_type: "", warranty_requirements: "",
  tear_off_details: "", parapet_wall_measurements: "", ac_work_details: "", plywood_fascia_notes: "", detail_component_notes: "", accessories_needed: "",
  deck_material_requirements: "", shingle_selection: "", tile_selection: "", warranty_upgrade_options: "", subcontractor_requirements: "",
  roof_access_details: "", permit_requirements: "", weekend_work_availability: "", overspray_risk_notes: "", parking_zone_sign_locations: "",
  estimated_material_quantities: "", estimated_labor_assumptions: "",
  target_price: "", pricing_notes: "", margin_markup_assumptions: "", payment_deposit_terms: "", deposit_required: false,
  customer_requests: "", verbal_commitments: "", customer_deadline: "", salesperson_notes: "", manual_target_at: "",
});

const labelize = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const dateTime = (value) => value ? new Date(value).toLocaleString() : "—";
const submittedValue = (value) => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value ?? "").trim();
  return text || "Not provided";
};

export default function ProposalRequests({ supabase, authUser, profiles = [] }) {
  const [requests, setRequests] = useState([]);
  const [versions, setVersions] = useState([]);
  const [changeOrders, setChangeOrders] = useState([]);
  const [audit, setAudit] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [draft, setDraft] = useState(() => blankDraft(authUser?.key));
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState("queue");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [exportBusy, setExportBusy] = useState("");
  const [filters, setFilters] = useState({ status: "all", priority: "all", salesperson: "all", jobType: "all", search: "", sort: "due" });
  const [missingNotes, setMissingNotes] = useState("");
  const [sectionDraft, setSectionDraft] = useState("Main roofing scope\nOptional section");
  const [wordFile, setWordFile] = useState(null);
  const [finalPdfFile, setFinalPdfFile] = useState(null);
  const [signedPdfFile, setSignedPdfFile] = useState(null);
  const [signerName, setSignerName] = useState("");
  const [approvedSectionIds, setApprovedSectionIds] = useState([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [changeOrderDraft, setChangeOrderDraft] = useState({ description: "", scope: "", price: "", required: true });
  const [managementDraft, setManagementDraft] = useState({ estimatorId: "", priority: "normal", targetAt: "" });

  const role = String(authUser?.role || "").toLowerCase();
  const email = String(authUser?.email || "").toLowerCase();
  const isManager = role === "admin" || role === "cfo";
  const isEstimator = role === "estimator" || email === "daniela@crtroofing.com" || isManager;
  const selected = requests.find((request) => request.id === selectedId) || null;
  const selectedVersions = versions.filter((version) => version.proposal_request_id === selectedId).sort((a, b) => b.version_number - a.version_number);
  const selectedOrders = changeOrders.filter((order) => order.proposal_request_id === selectedId);
  const selectedAudit = audit.filter((event) => event.proposal_request_id === selectedId);
  const selectedAttachments = attachments.filter((item) => item.proposal_request_id === selectedId);
  const latestVersion = selectedVersions[0] || null;
  const blockers = selected ? buildProductionGateReasons(selected, selectedVersions, selectedOrders) : [];
  const metrics = useMemo(() => calculateProposalMetrics(requests), [requests]);
  const salespersonMetrics = useMemo(() => profiles
    .filter((profile) => requests.some((request) => request.salesperson_id === profile.id))
    .map((profile) => ({
      id: profile.id,
      name: profile.full_name || profile.email || "Unknown salesperson",
      ...calculateProposalMetrics(requests.filter((request) => request.salesperson_id === profile.id)),
    })), [profiles, requests]);

  const load = useCallback(async () => {
    const [requestResult, versionResult, orderResult, auditResult, attachmentResult] = await Promise.all([
      supabase.from("proposal_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("proposal_versions").select("*").order("version_number", { ascending: false }),
      supabase.from("proposal_change_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("proposal_request_audit_events").select("*").order("created_at", { ascending: false }),
      supabase.from("proposal_request_attachments").select("*").order("created_at", { ascending: false }),
    ]);
    const firstError = [requestResult.error, versionResult.error, orderResult.error, auditResult.error, attachmentResult.error].find(Boolean);
    if (firstError) { setError(firstError.message); return; }
    setRequests(requestResult.data || []); setVersions(versionResult.data || []); setChangeOrders(orderResult.data || []);
    setAudit(auditResult.data || []); setAttachments(attachmentResult.data || []);
  }, [supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);
  useEffect(() => {
    const channel = supabase.channel(`proposal-requests-${authUser?.key}`).on("postgres_changes", { event: "*", schema: "public", table: "proposal_requests" }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser?.key, load, supabase]);

  const run = async (action, success) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await action();
      if (result.error) throw result.error;
      setMessage(success); await load(); return result.data;
    } catch (actionError) { setError(actionError.message || String(actionError)); return null; }
    finally { setBusy(false); }
  };

  const uploadFilesToRequest = async (requestId, files) => {
    const uploaded = [];
    const failed = [];
    for (const [index, file] of files.entries()) {
      setUploadProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
      let path = "";
      try {
        const validationError = validateProposalRequestAttachment(file);
        if (validationError) throw new Error(validationError);
        path = buildProposalRequestAttachmentPath(requestId, file.name, crypto.randomUUID());
        const upload = await supabase.storage.from("proposal-request-files").upload(path, file, { contentType: file.type, upsert: false });
        if (upload.error) throw upload.error;
        const registration = await supabase.rpc("register_proposal_request_attachment", {
          p_request_id: requestId,
          p_category: proposalRequestAttachmentCategory(file),
          p_file_name: file.name,
          p_storage_path: path,
          p_content_type: file.type,
          p_file_size: file.size,
        });
        if (registration.error) throw registration.error;
        uploaded.push(file);
      } catch (uploadError) {
        if (path) await supabase.storage.from("proposal-request-files").remove([path]);
        failed.push({ file, error: uploadError.message || String(uploadError) });
      }
    }
    setUploadProgress("");
    return { uploaded, failed };
  };

  const saveDraft = async () => {
    setBusy(true); setError(""); setMessage("");
    let saved = null;
    const filesToUpload = [...pendingAttachments];
    try {
      const result = await supabase.rpc("save_proposal_request", { p_request_id: selected?.id || null, p_payload: draft });
      if (result.error) throw result.error;
      saved = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!saved?.id) throw new Error("The Proposal Request draft could not be created.");
      setSelectedId(saved.id);
      setDraft({ ...blankDraft(authUser.key), ...saved });
      const uploadResult = filesToUpload.length ? await uploadFilesToRequest(saved.id, filesToUpload) : { uploaded: [], failed: [] };
      setPendingAttachments(uploadResult.failed.map((item) => item.file));
      setMessage(uploadResult.uploaded.length
        ? `Proposal Request draft saved with ${uploadResult.uploaded.length} attachment${uploadResult.uploaded.length === 1 ? "" : "s"}.`
        : "Proposal Request draft saved.");
      await load();
      if (uploadResult.failed.length) {
        setError(`${uploadResult.failed.length} file${uploadResult.failed.length === 1 ? "" : "s"} could not be uploaded and remain selected for retry: ${uploadResult.failed.map((item) => `${item.file.name} (${item.error})`).join("; ")}`);
        return null;
      }
      return saved;
    } catch (actionError) {
      setError(saved?.id
        ? `The draft was saved, but its files could not be uploaded: ${actionError.message || String(actionError)}`
        : actionError.message || String(actionError));
      return null;
    } finally { setBusy(false); setUploadProgress(""); }
  };

  const submit = async () => {
    const validation = validateProposalRequest(draft);
    if (!validation.valid) { setError(`Complete these required fields before submitting: ${validation.missing.join(", ")}`); return; }
    const saved = await saveDraft();
    if (!saved?.id) return;
    await run(() => supabase.rpc("submit_proposal_request", { p_request_id: saved.id }), draft.priority === "rush" ? "Rush approval requested." : "Proposal Request submitted to Daniela.");
    setView("queue");
  };

  const openRequest = (request) => {
    setSelectedId(request.id); setDraft({ ...blankDraft(authUser.key), ...request });
    setPendingAttachments([]);
    setManagementDraft({ estimatorId: request.assigned_estimator_id || "", priority: request.priority || "normal", targetAt: request.target_completion_at ? String(request.target_completion_at).slice(0, 16) : "" });
    setView("detail"); setError(""); setMessage("");
  };
  const newRequest = () => { setSelectedId(""); setDraft(blankDraft(authUser.key)); setPendingAttachments([]); setView("form"); };

  const queue = useMemo(() => requests.filter((request) => {
    const search = filters.search.toLowerCase();
    return (filters.status === "all" || request.status === filters.status)
      && (filters.priority === "all" || request.priority === filters.priority)
      && (filters.salesperson === "all" || request.salesperson_id === filters.salesperson)
      && (filters.jobType === "all" || request.job_type === filters.jobType)
      && (!search || [request.customer_name, request.property_name, request.service_address].join(" ").toLowerCase().includes(search));
  }).sort((a, b) => {
    if (filters.sort === "priority") return ({ rush: 0, high: 1, normal: 2 }[a.priority] ?? 3) - ({ rush: 0, high: 1, normal: 2 }[b.priority] ?? 3);
    if (filters.sort === "submitted") return new Date(b.submitted_at || b.created_at) - new Date(a.submitted_at || a.created_at);
    return new Date(a.target_completion_at || "9999-12-31") - new Date(b.target_completion_at || "9999-12-31");
  }), [filters, requests]);

  const selectPendingAttachments = (event) => {
    const files = Array.from(event.target.files || []);
    const invalid = files.map(validateProposalRequestAttachment).filter(Boolean);
    if (invalid.length) setError(invalid.join(" "));
    const valid = files.filter((file) => !validateProposalRequestAttachment(file));
    setPendingAttachments((current) => [...current, ...valid.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified))]);
    event.target.value = "";
  };

  const uploadAttachment = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !selectedId) return;
    const invalid = files.map(validateProposalRequestAttachment).find(Boolean);
    if (invalid) { setError(invalid); event.target.value = ""; return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await uploadFilesToRequest(selectedId, files);
      if (result.uploaded.length) setMessage(`${result.uploaded.length} attachment${result.uploaded.length === 1 ? "" : "s"} uploaded.`);
      if (result.failed.length) setError(`${result.failed.length} file${result.failed.length === 1 ? "" : "s"} failed: ${result.failed.map((item) => `${item.file.name} (${item.error})`).join("; ")}`);
      await load();
    } finally {
      setBusy(false); setUploadProgress(""); event.target.value = "";
    }
  };

  const uploadProposalDocument = async (file, kind) => {
    if (!file) return "";
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_");
    const path = `${selectedId}/proposal-${kind}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from("proposal-request-files").upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) throw upload.error;
    return path;
  };

  const saveExternalVersion = async (finalize) => {
    if (!wordFile) { setError("Upload Daniela's Word proposal before saving a version."); return; }
    if (finalize && !finalPdfFile) { setError("Upload the finalized PDF before sending the version to Sales Review."); return; }
    const sections = sectionDraft.split("\n").map((line, index) => line.trim() ? ({ id: `section-${Date.now()}-${index}`, title: line.trim(), scope: line.trim(), customer_approved: false }) : null).filter(Boolean);
    if (!sections.length) { setError("List at least one proposal section or alternate."); return; }
    await run(async () => {
      const wordPath = await uploadProposalDocument(wordFile, "word");
      const pdfPath = finalPdfFile ? await uploadProposalDocument(finalPdfFile, "final-pdf") : "";
      return supabase.rpc("save_external_proposal_version", {
        p_request_id: selectedId, p_sections: sections,
        p_source_document_path: wordPath, p_source_document_name: wordFile.name,
        p_final_pdf_path: pdfPath, p_final_pdf_name: finalPdfFile?.name || "", p_finalize: finalize,
      });
    }, finalize ? "Final PDF saved and sent to Sales Review." : "Word proposal version saved.");
    setWordFile(null); setFinalPdfFile(null);
  };

  const openDocument = async (path) => {
    if (!path) return;
    const { data, error: signedUrlError } = await supabase.storage.from("proposal-request-files").createSignedUrl(path, 300);
    if (signedUrlError) { setError(signedUrlError.message); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const createChangeOrderSigningLink = async (id) => {
    const fn = "create_change_order_signing_session";
    const args = { p_change_order_id: id, p_expires_hours: 168 };
    const data = await run(() => supabase.rpc(fn, args), "Secure signing link created and copied.");
    const result = Array.isArray(data) ? data[0] : data;
    if (result?.token) {
      await navigator.clipboard?.writeText(`${window.location.origin}/?change-order-signing-token=${result.token}`);
    }
  };

  const recordSignedProposal = async () => {
    if (!signedPdfFile || !signerName.trim() || !approvedSectionIds.length) { setError("Upload the signed PDF, enter the signer name, and select the approved section(s)."); return; }
    await run(async () => {
      const signedPath = await uploadProposalDocument(signedPdfFile, "signed-pdf");
      return supabase.rpc("record_external_proposal_execution", {
        p_version_id: latestVersion.id, p_customer_name: signerName.trim(), p_signed_pdf_path: signedPath,
        p_signed_pdf_name: signedPdfFile.name, p_approved_section_ids: approvedSectionIds, p_customer_signed_at: new Date().toISOString(),
      });
    }, "Signed proposal recorded. Authorized Production Scope is ready for release checks.");
    setSignedPdfFile(null); setSignerName(""); setApprovedSectionIds([]);
  };

  const salespersonName = selected ? (profiles.find((profile) => profile.id === selected.salesperson_id)?.full_name || profiles.find((profile) => profile.id === selected.salesperson_id)?.email || "Not assigned") : "";
  const exportOptions = selected ? { request: selected, salespersonName, fieldGroups: textFields, attachments: selectedAttachments } : null;
  const exportPdf = () => {
    if (!exportOptions) return;
    setError("");
    try { downloadProposalRequestPdf(exportOptions); setMessage("Proposal Request PDF downloaded."); }
    catch (exportError) { setError(exportError.message || String(exportError)); }
  };
  const exportZip = async () => {
    if (!exportOptions) return;
    setExportBusy("zip"); setError(""); setMessage("");
    try { await downloadProposalRequestZip({ supabase, ...exportOptions }); setMessage("Complete Proposal Request ZIP downloaded."); }
    catch (exportError) { setError(exportError.message || String(exportError)); }
    finally { setExportBusy(""); }
  };

  return <section className="proposalRequestWorkspace">
    <div className="proposalRequestTopbar">
      <div><p className="eyebrow">Centralized Estimating</p><h2>Proposal Requests</h2><p>Complete scope in, authorized production scope out.</p></div>
      <div className="proposalRequestActions"><button type="button" className="secondaryButton" onClick={() => setView("queue")}>Queue</button><button type="button" className="primaryButton" onClick={newRequest}>New Proposal Request</button></div>
    </div>
    {error ? <p className="statusMessage dangerMessage">{error}</p> : null}{message ? <p className="statusMessage proposalSuccess">{message}</p> : null}

    {view === "queue" ? <>
      {isManager ? <div className="proposalMetrics">
        <span>Submitted <b>{metrics.submitted}</b></span><span>Sent <b>{metrics.sent}</b></span><span>Signed <b>{metrics.signed}</b></span>
        <span>Avg. turnaround <b>{metrics.averageTurnaroundHours.toFixed(1)}h</b></span><span>Overdue <b>{metrics.overdue}</b></span>
        <span>Incomplete returned <b>{metrics.missingInformation}</b></span><span>Conversion <b>{metrics.conversionRate.toFixed(0)}%</b></span><span>Unauthorized starts <b>{metrics.unauthorizedStarts}</b></span>
      </div> : null}
      {isManager && salespersonMetrics.length ? <div className="proposalSalesMetrics" aria-label="Proposal turnaround by salesperson">
        <strong>Turnaround by salesperson</strong>
        {salespersonMetrics.map((person) => <span key={person.id}>{person.name}: <b>{person.averageTurnaroundHours.toFixed(1)}h</b> average · {person.submitted} submitted · {person.signed} signed</span>)}
      </div> : null}
      <div className="proposalFilters">
        <input type="search" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Search customer, job, or address" />
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}><option value="all">All statuses</option>{["draft","submitted","under_review","missing_information","drafting_proposal","sales_review","ready_to_send","sent","signed","declined","closed"].map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select>
        <select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}><option value="all">All priorities</option>{PROPOSAL_REQUEST_PRIORITIES.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={filters.salesperson} onChange={(e) => setFilters((f) => ({ ...f, salesperson: e.target.value }))}><option value="all">All salespeople</option>{profiles.filter((p) => ["salesperson","admin","cfo"].includes(String(p.role).toLowerCase())).map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select>
        <select value={filters.jobType} onChange={(e) => setFilters((f) => ({ ...f, jobType: e.target.value }))}><option value="all">All job types</option>{PROPOSAL_JOB_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
        <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}><option value="due">Sort: due date</option><option value="priority">Sort: priority</option><option value="submitted">Sort: submitted</option></select>
      </div>
      <div className="proposalQueue">{queue.map((request) => { const sla = getSlaDisplay(request); return <button type="button" key={request.id} className={`proposalQueueCard ${sla.tone}`} onClick={() => openRequest(request)}>
        <span className={`proposalStatus ${request.status}`}>{labelize(request.status)}</span><span className={`proposalPriority ${request.priority}`}>{request.priority}</span>
        <strong>PR-{request.request_number} · {request.property_name || "Untitled job"}</strong><p>{request.customer_name} · {request.service_address}</p>
        <small>Sales: {profiles.find((p) => p.id === request.salesperson_id)?.full_name || "Unassigned"} · Submitted: {dateTime(request.submitted_at)} · <b>{sla.label}</b></small>
      </button>; })}{!queue.length ? <p className="emptyState">No Proposal Requests match this view.</p> : null}</div>
    </> : null}

    {view === "form" ? <form className="proposalRequestForm" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <section className="panel"><h3>Request setup</h3><div className="proposalFieldGrid">
        <label><span>Assigned salesperson *</span><select value={draft.salesperson_id} onChange={(e) => setDraft((d) => ({ ...d, salesperson_id: e.target.value }))}>{(isManager ? profiles : profiles.filter((p) => p.id === authUser.key)).map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></label>
        <label><span>Job type *</span><select value={draft.job_type} onChange={(e) => setDraft((d) => ({ ...d, job_type: e.target.value }))}>{PROPOSAL_JOB_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label><span>Priority</span><select value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}>{PROPOSAL_REQUEST_PRIORITIES.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Customer deadline *</span><input type="date" value={draft.customer_deadline || ""} onChange={(e) => setDraft((d) => ({ ...d, customer_deadline: e.target.value }))} /></label>
        {draft.job_type === "large_rfp" ? <label><span>Manual ETA *</span><input type="datetime-local" value={draft.manual_target_at || ""} onChange={(e) => setDraft((d) => ({ ...d, manual_target_at: e.target.value }))} /></label> : null}
        <label><span>Estimated crew size *</span><input type="number" min="1" value={draft.estimated_crew_size || ""} onChange={(e) => setDraft((d) => ({ ...d, estimated_crew_size: e.target.value }))} /></label>
        <label><span>Estimated working days *</span><input type="number" min="0.5" step="0.5" value={draft.estimated_working_days || ""} onChange={(e) => setDraft((d) => ({ ...d, estimated_working_days: e.target.value }))} /></label>
        <label><span>Target price</span><input type="number" min="0" step="0.01" value={draft.target_price || ""} onChange={(e) => setDraft((d) => ({ ...d, target_price: e.target.value }))} /></label>
        <label className="proposalCheckbox"><input type="checkbox" checked={Boolean(draft.deposit_required)} onChange={(e) => setDraft((d) => ({ ...d, deposit_required: e.target.checked }))} /><span>Deposit required before production</span></label>
      </div></section>
      {textFields.map(([title, fields]) => <section className="panel" key={title}><h3>{title}</h3><div className="proposalFieldGrid">{fields.map(([key, label, required, kind, options]) => <label key={key} className={kind === "textarea" ? "proposalWide" : ""}><span>{label}{required ? " *" : ""}</span>{kind === "textarea" ? <textarea rows="3" value={draft[key] || ""} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} /> : kind === "select" ? <select value={draft[key] || ""} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}><option value="">Select an answer</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input value={draft[key] || ""} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />}</label>)}</div></section>)}
      <section className="panel proposalIntakeAttachments">
        <h3>Photos & supporting files</h3>
        <p>Attach roof photos, measurements, roof reports, drawings, RFPs, customer documents, Word files, spreadsheets, or PDFs. Each file may be up to 25 MB.</p>
        <label className="proposalFilePicker"><span>{pendingAttachments.length ? "Add More Photos & Files" : "Choose Photos & Files"}</span><input type="file" multiple accept={PROPOSAL_REQUEST_FILE_ACCEPT} onChange={selectPendingAttachments} disabled={busy} /></label>
        {uploadProgress ? <p className="proposalUploadProgress" role="status">{uploadProgress}</p> : null}
        {pendingAttachments.length ? <div className="proposalPendingFiles"><strong>Ready to upload when you save or submit:</strong>{pendingAttachments.map((file, index) => <div key={`${file.name}-${file.size}-${file.lastModified}`}><span>{file.name}</span><button type="button" className="secondaryButton" onClick={() => setPendingAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div> : <p className="emptyState">No new files selected.</p>}
        {selectedAttachments.length ? <div className="proposalDocumentLinks"><strong>Already uploaded:</strong>{selectedAttachments.map((item) => <button type="button" className="secondaryButton" key={item.id} onClick={() => void openDocument(item.storage_path)}>Open {item.file_name}</button>)}</div> : null}
      </section>
      <div className="proposalStickyActions"><button type="button" className="secondaryButton" disabled={busy} onClick={() => void saveDraft()}>Save Draft</button><button type="submit" className="primaryButton" disabled={busy}>{busy ? "Saving…" : draft.status === "missing_information" ? "Resubmit Complete Request" : "Submit to Daniela"}</button></div>
    </form> : null}

    {view === "detail" && selected ? <div className="proposalDetail">
      <section className="panel proposalDetailHeader"><div><p className="eyebrow">PR-{selected.request_number}</p><h3>{selected.property_name}</h3><p>{selected.customer_name} · {selected.service_address}</p></div><div><span className={`proposalStatus ${selected.status}`}>{labelize(selected.status)}</span><p>{getSlaDisplay(selected).label}</p></div></section>
      {selected.missing_information_notes ? <section className="panel proposalMissing"><h3>Missing information requested</h3><p>{selected.missing_information_notes}</p><button type="button" className="primaryButton" onClick={() => setView("form")}>Update request</button></section> : null}
      <section className="panel"><h3>Timing & responsibility</h3><div className="proposalFacts"><span>Submitted <b>{dateTime(selected.submitted_at)}</b></span><span>Target <b>{dateTime(selected.target_completion_at)}</b></span><span>Priority <b>{labelize(selected.priority)}</b></span><span>Estimator <b>{profiles.find((p) => p.id === selected.assigned_estimator_id)?.full_name || "Daniela"}</b></span></div></section>
      <section className="panel proposalSubmittedDetails"><div className="sectionHead"><div><h3>Submitted Request Details</h3><p>The complete information submitted by the salesperson for Daniela's review.</p></div>{isEstimator ? <div className="proposalRequestActions"><button type="button" className="secondaryButton" disabled={Boolean(exportBusy)} onClick={exportPdf}>Download Proposal Info PDF</button><button type="button" className="primaryButton" disabled={Boolean(exportBusy)} onClick={() => void exportZip()}>{exportBusy === "zip" ? "Preparing ZIP..." : "Download Complete ZIP"}</button></div> : null}</div>
        <details open><summary>Request setup</summary><div className="proposalReadOnlyGrid">
          <div><span>Assigned salesperson</span><strong>{profiles.find((p) => p.id === selected.salesperson_id)?.full_name || profiles.find((p) => p.id === selected.salesperson_id)?.email || "Not assigned"}</strong></div>
          <div><span>Job type</span><strong>{PROPOSAL_JOB_TYPES.find((type) => type.value === selected.job_type)?.label || labelize(selected.job_type)}</strong></div>
          <div><span>Priority</span><strong>{labelize(selected.priority)}</strong></div>
          <div><span>Customer deadline</span><strong>{submittedValue(selected.customer_deadline)}</strong></div>
          <div><span>Estimated crew size</span><strong>{submittedValue(selected.estimated_crew_size)}</strong></div>
          <div><span>Estimated working days</span><strong>{submittedValue(selected.estimated_working_days)}</strong></div>
          <div><span>Target price</span><strong>{selected.target_price === null || selected.target_price === "" ? "Not provided" : money(selected.target_price)}</strong></div>
          <div><span>Deposit required</span><strong>{selected.deposit_required ? "Yes" : "No"}</strong></div>
        </div></details>
        {textFields.map(([title, fields]) => <details key={title} open={title === "Customer / Job Information" || title === "Scope Information"}><summary>{title}</summary><div className="proposalReadOnlyGrid">{fields.map(([key, label]) => <div key={key} className={String(selected[key] || "").length > 120 ? "proposalReadOnlyWide" : ""}><span>{label}</span><strong>{submittedValue(selected[key])}</strong></div>)}</div></details>)}
      </section>
      {isEstimator ? <section className="panel"><h3>Queue management</h3><div className="proposalFieldGrid">
        <label><span>Target completion</span><input type="datetime-local" value={managementDraft.targetAt} onChange={(e) => setManagementDraft((d) => ({ ...d, targetAt: e.target.value }))} /></label>
        {isManager ? <><label><span>Assigned estimator</span><select value={managementDraft.estimatorId} onChange={(e) => setManagementDraft((d) => ({ ...d, estimatorId: e.target.value }))}><option value="">Keep current</option>{profiles.filter((p) => String(p.role).toLowerCase() === "estimator" || String(p.email).toLowerCase() === "daniela@crtroofing.com").map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></label><label><span>Priority</span><select value={managementDraft.priority} onChange={(e) => setManagementDraft((d) => ({ ...d, priority: e.target.value }))}>{PROPOSAL_REQUEST_PRIORITIES.map((value) => <option key={value}>{value}</option>)}</select></label></> : null}
        <button type="button" className="secondaryButton" onClick={() => run(() => supabase.rpc("manage_proposal_request", { p_request_id: selected.id, p_estimator_id: isManager ? managementDraft.estimatorId || null : null, p_priority: isManager ? managementDraft.priority : null, p_target_at: managementDraft.targetAt || null }), "Queue assignment and ETA updated.")}>Save queue settings</button>
      </div></section> : null}
      {isEstimator && ["submitted","under_review"].includes(selected.status) ? <section className="panel"><h3>Estimator review</h3><div className="proposalRequestActions"><button type="button" className="primaryButton" disabled={busy} onClick={() => run(() => supabase.rpc("review_proposal_request", { p_request_id: selected.id, p_action: "accept", p_missing_notes: "", p_target_at: selected.target_completion_at }), "Accepted into the estimating queue.")}>Accept into queue</button><input value={missingNotes} onChange={(e) => setMissingNotes(e.target.value)} placeholder="Describe exactly what is missing" /><button type="button" className="secondaryButton" disabled={busy || !missingNotes.trim()} onClick={() => run(() => supabase.rpc("review_proposal_request", { p_request_id: selected.id, p_action: "missing_information", p_missing_notes: missingNotes, p_target_at: null }), "Returned to salesperson; SLA paused.")}>Request information</button></div></section> : null}
      {isManager && selected.priority === "rush" && selected.rush_approval_status === "pending" ? <section className="panel"><h3>Rush approval</h3><div className="proposalRequestActions"><button className="primaryButton" onClick={() => run(() => supabase.rpc("approve_rush_proposal_request", { p_request_id: selected.id, p_approved: true, p_notes: "" }), "Rush approved.")}>Approve Rush</button><button className="secondaryButton" onClick={() => run(() => supabase.rpc("approve_rush_proposal_request", { p_request_id: selected.id, p_approved: false, p_notes: "" }), "Rush rejected; priority set to High.")}>Reject Rush</button></div></section> : null}
      <section className="panel"><h3>Documentation / attachments</h3><input type="file" multiple accept={PROPOSAL_REQUEST_FILE_ACCEPT} onChange={uploadAttachment} disabled={busy} /> <small>{selectedAttachments.length} file(s) attached</small>{uploadProgress ? <p className="proposalUploadProgress" role="status">{uploadProgress}</p> : null}{selectedAttachments.length ? <div className="proposalDocumentLinks">{selectedAttachments.map((item) => <button type="button" className="secondaryButton" key={item.id} onClick={() => void openDocument(item.storage_path)}>Open {item.file_name}</button>)}</div> : <p className="emptyState">No supporting files were attached.</p>}</section>
      {isEstimator ? <section className="panel"><h3>Proposal documents</h3><p>Prepare the proposal in Microsoft Word. Upload the working Word file as the editable source, then upload the finalized PDF for Sales Review. The app tracks the workflow and documents; it does not build the proposal.</p><label className="proposalWide"><span>Proposal sections / alternates (one per line)</span><textarea rows="5" value={sectionDraft} onChange={(e) => setSectionDraft(e.target.value)} /></label><div className="proposalFieldGrid proposalDocumentInputs"><label><span>Working Word proposal (.docx) *</span><input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setWordFile(e.target.files?.[0] || null)} /></label><label><span>Final customer PDF (required for Sales Review)</span><input type="file" accept=".pdf,application/pdf" onChange={(e) => setFinalPdfFile(e.target.files?.[0] || null)} /></label></div><div className="proposalRequestActions"><button className="secondaryButton" disabled={busy || !wordFile} onClick={() => void saveExternalVersion(false)}>Save Word version</button><button className="primaryButton" disabled={busy || !wordFile || !finalPdfFile} onClick={() => void saveExternalVersion(true)}>Finalize PDF for Sales Review</button></div></section> : null}
      {latestVersion ? <section className="panel"><h3>Proposal document version {latestVersion.version_number}</h3><div className="proposalDocumentLinks">{latestVersion.source_document_storage_path ? <button className="secondaryButton" onClick={() => void openDocument(latestVersion.source_document_storage_path)}>Open Word: {latestVersion.source_document_file_name}</button> : null}{latestVersion.final_pdf_storage_path ? <button className="secondaryButton" onClick={() => void openDocument(latestVersion.final_pdf_storage_path)}>Open final PDF: {latestVersion.final_pdf_file_name}</button> : null}{latestVersion.signed_pdf_storage_path ? <button className="secondaryButton" onClick={() => void openDocument(latestVersion.signed_pdf_storage_path)}>Open signed PDF: {latestVersion.signed_pdf_file_name}</button> : null}</div><div className="proposalSections">{(latestVersion.sections || []).map((section) => <div key={section.id} className={section.customer_approved ? "authorized" : ""}><strong>{section.title}</strong><p>{section.scope}</p><span>{section.customer_approved ? "APPROVED" : latestVersion.customer_decision === "signed" ? "NOT APPROVED" : "Pending customer selection"}</span></div>)}</div>
        {selected.status === "sales_review" && selected.salesperson_id === authUser.key ? <label className="proposalAcknowledgement"><input type="checkbox" onChange={(e) => e.target.checked && run(() => supabase.rpc("approve_proposal_scope", { p_version_id: latestVersion.id, p_acknowledgement: SALES_APPROVAL_ACKNOWLEDGEMENT }), "Scope approved. Daniela may send the proposal.")} />{SALES_APPROVAL_ACKNOWLEDGEMENT}</label> : null}
        {isEstimator && latestVersion.sales_approved_at && !latestVersion.sent_at ? <button className="primaryButton" onClick={() => run(() => supabase.rpc("mark_external_proposal_sent", { p_version_id: latestVersion.id }), "Proposal marked sent externally.")}>Mark proposal sent externally</button> : null}
        {isEstimator && latestVersion.sent_at && latestVersion.customer_decision === "pending" ? <div className="proposalSignedUpload"><h4>Record signed proposal</h4><p>After the customer signs outside the app, upload the signed PDF and identify exactly which sections were approved.</p><div className="proposalFieldGrid"><label><span>Customer / signer name</span><input value={signerName} onChange={(e) => setSignerName(e.target.value)} /></label><label><span>Signed proposal PDF</span><input type="file" accept=".pdf,application/pdf" onChange={(e) => setSignedPdfFile(e.target.files?.[0] || null)} /></label></div><div className="proposalSectionChoices">{(latestVersion.sections || []).map((section) => <label key={section.id}><input type="checkbox" checked={approvedSectionIds.includes(section.id)} onChange={(e) => setApprovedSectionIds((ids) => e.target.checked ? [...ids, section.id] : ids.filter((id) => id !== section.id))} />{section.title}</label>)}</div><button className="primaryButton" disabled={busy || !signedPdfFile || !signerName.trim() || !approvedSectionIds.length} onClick={() => void recordSignedProposal()}>Record customer signature</button></div> : null}
      </section> : null}
      {isEstimator ? <section className="panel"><h3>Change orders</h3><div className="proposalFieldGrid"><input placeholder="Description" value={changeOrderDraft.description} onChange={(e) => setChangeOrderDraft((d) => ({ ...d, description: e.target.value }))} /><input placeholder="Scope" value={changeOrderDraft.scope} onChange={(e) => setChangeOrderDraft((d) => ({ ...d, scope: e.target.value }))} /><input type="number" placeholder="Price" value={changeOrderDraft.price} onChange={(e) => setChangeOrderDraft((d) => ({ ...d, price: e.target.value }))} /><button className="secondaryButton" onClick={() => run(() => supabase.rpc("save_proposal_change_order", { p_request_id: selected.id, p_description: changeOrderDraft.description, p_scope: changeOrderDraft.scope, p_price: changeOrderDraft.price || 0, p_required: changeOrderDraft.required }), "Change order created.")}>Create change order</button></div>{selectedOrders.map((order) => <div className="proposalOrder" key={order.id}><span>{order.description} · {money(order.price)} · {labelize(order.status)}</span>{order.status === "draft" ? <button className="secondaryButton" onClick={() => void createChangeOrderSigningLink(order.id)}>Create signing link</button> : null}</div>)}</section> : null}
      <section className="panel productionGate"><h3>{blockers.length ? "BLOCKED FROM PRODUCTION" : selected.production_released_at ? "READY FOR PRODUCTION" : "Production release checks passed"}</h3>{blockers.length ? <ul>{blockers.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>Signed and authorized scope is ready for production.</p>}
        <div className="authorizedScope"><div><strong>AUTHORIZED SCOPE</strong>{(selected.production_scope?.authorized || []).map((item) => <p key={item.id}>✓ {item.title || item.scope}</p>)}</div><div><strong>NOT AUTHORIZED</strong>{(selected.production_scope?.not_authorized || []).map((item) => <p key={item.id}>✕ {item.title || item.scope}</p>)}</div></div>
        {isEstimator && selected.deposit_required ? <label className="proposalAcknowledgement"><input type="checkbox" checked={Boolean(selected.deposit_satisfied_at)} onChange={(e) => run(() => supabase.rpc("set_proposal_deposit_satisfied", { p_request_id: selected.id, p_satisfied: e.target.checked }), e.target.checked ? "Deposit condition marked satisfied." : "Deposit condition reopened.")} />Required deposit / payment condition satisfied</label> : null}
        {isEstimator && !selected.production_released_at ? <div className="proposalRequestActions">{isManager && blockers.length ? <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Mandatory admin override reason" /> : null}<button className="primaryButton" disabled={busy || (blockers.length > 0 && (!isManager || !overrideReason.trim()))} onClick={() => run(() => supabase.rpc("release_proposal_to_production", { p_request_id: selected.id, p_override_reason: overrideReason }), "Job released to Ready for Production.")}>Release to Production</button></div> : null}
      </section>
      <section className="panel"><h3>Audit history</h3><div className="proposalAudit">{selectedAudit.map((event) => <div key={event.id}><strong>{labelize(event.action)}</strong><span>{dateTime(event.created_at)}</span><p>{event.notes}</p></div>)}</div></section>
      {selected.status !== "closed" && (["signed","declined"].includes(selected.status) || selected.production_released_at) ? <div className="proposalRequestActions"><button type="button" className="secondaryButton" onClick={() => run(() => supabase.rpc("close_proposal_request", { p_request_id: selected.id, p_notes: "Workflow complete" }), "Proposal Request closed.")}>Close completed request</button></div> : null}
    </div> : null}
  </section>;
}
