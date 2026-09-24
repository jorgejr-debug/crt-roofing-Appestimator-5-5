import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PROPOSAL_JOB_TYPES,
  PROPOSAL_REQUEST_PRIORITIES,
  SALES_APPROVAL_ACKNOWLEDGEMENT,
  buildProductionGateReasons,
  calculateProposalMetrics,
  getSlaDisplay,
  validateProposalRequest,
  validateQuickInspectionHandoff,
} from "./proposalRequestWorkflow.js";
import { downloadProposalRequestPdf, downloadProposalRequestZip } from "./proposalRequestExport.js";
import FileDropZone from "./FileDropZone.jsx";
import ActionFeedback from "./ActionFeedback.jsx";
import {
  PROPOSAL_REQUEST_FILE_ACCEPT,
  buildProposalRequestAttachmentPath,
  proposalRequestAttachmentCategory,
  validateProposalRequestAttachment,
} from "./proposalRequestAttachments.js";
import {
  INSPECTION_HANDOFF_FIELD_LABELS,
  applyInspectionExtractionToDraft,
  inspectionExtractionReadiness,
} from "./inspectionHandoffExtraction.js";
import "./ProposalRequests.css";

const DRAFT_PROPOSAL_FILE_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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
  salesperson_id: userId, assigned_estimator_id: "", priority: "normal", job_type: "standard_roof", existing_lead_job_id: "", source_lead_id: "",
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
const requestStatusLabel = (request) => request?.draft_handoff_status === "awaiting_review"
  ? (request.intake_mode === "draft_proposal" ? "Draft Proposal Review" : "Inspection Handoff Review")
  : labelize(request?.status);
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const dateTime = (value) => value ? new Date(value).toLocaleString() : "—";
const submittedValue = (value) => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value ?? "").trim();
  return text || "Not provided";
};

export default function ProposalRequests({ supabase, authUser, profiles = [], initialView = "queue" }) {
  const [requests, setRequests] = useState([]);
  const [crmLeads, setCrmLeads] = useState([]);
  const [versions, setVersions] = useState([]);
  const [changeOrders, setChangeOrders] = useState([]);
  const [audit, setAudit] = useState([]);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [pendingDraftProposalFiles, setPendingDraftProposalFiles] = useState([]);
  const [inspectionText, setInspectionText] = useState("");
  const [inspectionExtraction, setInspectionExtraction] = useState(null);
  const [inspectionConfirmed, setInspectionConfirmed] = useState(false);
  const [inspectionConfirmedFingerprint, setInspectionConfirmedFingerprint] = useState("");
  const [inspectionBusy, setInspectionBusy] = useState(false);
  const [draft, setDraft] = useState(() => blankDraft(authUser?.key));
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState(initialView);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submissionNotice, setSubmissionNotice] = useState({ tone: "", text: "" });
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
  const [changeOrderDraft, setChangeOrderDraft] = useState({ description: "", scope: "", price: "", required: true });
  const [managementDraft, setManagementDraft] = useState({ estimatorId: "", priority: "normal", targetAt: "" });
  const [commentDraft, setCommentDraft] = useState("");

  const role = String(authUser?.role || "").toLowerCase();
  const email = String(authUser?.email || "").toLowerCase();
  const isManager = role === "admin" || role === "cfo";
  const isEstimator = role === "estimator" || email === "daniela@crtroofing.com" || isManager;
  const canCreateQuickHandoff = new Set(["admin", "cfo", "salesperson", "estimator"]).has(role)
    && email !== "daniela@crtroofing.com";
  const danielaProfile = profiles.find((profile) => String(profile.email || "").trim().toLowerCase() === "daniela@crtroofing.com") || null;
  const selected = requests.find((request) => request.id === selectedId) || null;
  const selectedVersions = versions.filter((version) => version.proposal_request_id === selectedId).sort((a, b) => b.version_number - a.version_number);
  const selectedOrders = changeOrders.filter((order) => order.proposal_request_id === selectedId);
  const selectedAudit = audit.filter((event) => event.proposal_request_id === selectedId);
  const selectedComments = comments
    .filter((comment) => comment.proposal_request_id === selectedId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const selectedAttachments = attachments.filter((item) => item.proposal_request_id === selectedId);
  const inspectionConfirmerName = selected?.inspection_confirmed_by
    ? (profiles.find((profile) => profile.id === selected.inspection_confirmed_by)?.full_name
      || profiles.find((profile) => profile.id === selected.inspection_confirmed_by)?.email
      || "Recorded inspector")
    : "";
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
  const inspectionReadiness = useMemo(
    () => inspectionExtractionReadiness(draft, inspectionExtraction || {}),
    [draft, inspectionExtraction],
  );
  const inspectionFingerprint = useMemo(
    () => JSON.stringify(Object.keys(INSPECTION_HANDOFF_FIELD_LABELS).map((key) => [key, String(draft[key] ?? "").trim()])),
    [draft],
  );
  const inspectionConfirmationValid = inspectionConfirmed && inspectionConfirmedFingerprint === inspectionFingerprint;

  const load = useCallback(async () => {
    const [requestResult, versionResult, orderResult, auditResult, attachmentResult, commentResult, leadResult] = await Promise.all([
      supabase.from("proposal_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("proposal_versions").select("*").order("version_number", { ascending: false }),
      supabase.from("proposal_change_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("proposal_request_audit_events").select("*").order("created_at", { ascending: false }),
      supabase.from("proposal_request_attachments").select("*").order("created_at", { ascending: false }),
      supabase.from("proposal_request_comments").select("*").order("created_at", { ascending: true }),
      supabase.from("crm_leads").select("id, contact_name, company_name, phone, email, property_address, city, zip_code, quick_note, service_needed, originator_name, originator_email, status").order("updated_at", { ascending: false }),
    ]);
    const firstError = [requestResult.error, versionResult.error, orderResult.error, auditResult.error, attachmentResult.error, commentResult.error, leadResult.error].find(Boolean);
    if (firstError) { setError(firstError.message); return; }
    setRequests(requestResult.data || []); setVersions(versionResult.data || []); setChangeOrders(orderResult.data || []);
    setAudit(auditResult.data || []); setAttachments(attachmentResult.data || []);
    setComments(commentResult.data || []);
    setCrmLeads(leadResult.data || []);
  }, [supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);
  useEffect(() => {
    const channel = supabase.channel(`proposal-requests-${authUser?.key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposal_requests" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "proposal_request_comments" }, load)
      .subscribe();
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

  const readFunctionError = async (functionError, fallback) => {
    let message = functionError?.message || fallback;
    try {
      const payload = await functionError?.context?.json();
      if (payload?.error) message = payload.error;
    } catch { /* Supabase did not return a JSON error body. */ }
    return message;
  };

  const organizeInspectionText = async () => {
    if (inspectionText.trim().length < 40) {
      setError("Paste or upload a longer PLAUD summary or transcript before organizing it.");
      return;
    }
    setInspectionBusy(true); setError(""); setMessage(""); setInspectionConfirmed(false); setInspectionConfirmedFingerprint("");
    const context = {
      customer_name: draft.customer_name || "",
      property_name: draft.property_name || "",
      service_address: draft.service_address || "",
      project_contact_first_name: draft.project_contact_first_name || "",
      project_contact_last_name: draft.project_contact_last_name || "",
      project_contact_phone: draft.project_contact_phone || "",
      project_contact_email: draft.project_contact_email || "",
    };
    try {
      const { data, error: functionError } = await supabase.functions.invoke("extract-inspection-handoff", {
        body: { transcript: inspectionText.trim(), context },
      });
      if (functionError) throw new Error(await readFunctionError(functionError, "The inspection could not be organized."));
      if (data?.error) throw new Error(data.error);
      const organized = applyInspectionExtractionToDraft(draft, data?.extraction || {});
      setDraft(organized.draft);
      setInspectionExtraction(organized.extraction);
      setMessage("Inspection organized. Review the extracted facts, correct anything needed, then confirm before sending.");
    } catch (organizeError) {
      setInspectionExtraction(null);
      setError(organizeError.message || String(organizeError));
    } finally { setInspectionBusy(false); }
  };

  const loadInspectionTextFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Use a PLAUD text export smaller than 2 MB, or paste the summary.");
      return;
    }
    const extension = String(file.name || "").split(".").pop()?.toLowerCase();
    if (!["txt", "md", "json"].includes(extension)) {
      setError("For automatic organization, upload a PLAUD TXT, Markdown, or JSON export. PDFs can still be added as supporting files below.");
      return;
    }
    try {
      const content = await file.text();
      setInspectionText(content);
      setInspectionExtraction(null);
      setInspectionConfirmed(false);
      setInspectionConfirmedFingerprint("");
      setMessage(`${file.name} loaded. Press Organize Inspection.`);
      setError("");
    } catch {
      setError("The PLAUD text export could not be read.");
    }
  };

  const uploadFilesToRequest = async (requestId, files, categoryOverride = "") => {
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
          p_category: categoryOverride || proposalRequestAttachmentCategory(file),
          p_file_name: file.name,
          p_storage_path: path,
          p_content_type: file.type,
          p_file_size: file.size,
        });
        if (registration.error) throw registration.error;
        uploaded.push({ file, attachment: registration.data });
      } catch (uploadError) {
        if (path) await supabase.storage.from("proposal-request-files").remove([path]);
        failed.push({ file, error: uploadError.message || String(uploadError) });
      }
    }
    if (uploaded.length) {
      const attachmentIds = uploaded.map((item) => item.attachment?.id).filter(Boolean);
      if (attachmentIds.length) {
        const notification = await supabase.rpc("notify_proposal_attachment_batch", {
          p_request_id: requestId,
          p_attachment_ids: attachmentIds,
        });
        if (notification.error) {
          setError(`Files uploaded, but the attachment notification could not be sent: ${notification.error.message}`);
        }
      }
    }
    setUploadProgress("");
    return { uploaded, failed };
  };

  const saveDraft = async (payloadOverride = draft) => {
    setBusy(true); setError(""); setMessage("");
    let saved = null;
    const filesToUpload = [...pendingAttachments];
    try {
      const result = await supabase.rpc("save_proposal_request", { p_request_id: selected?.id || null, p_payload: payloadOverride });
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
        const uploadMessage = `${uploadResult.failed.length} file${uploadResult.failed.length === 1 ? "" : "s"} could not be uploaded and remain selected for retry: ${uploadResult.failed.map((item) => `${item.file.name} (${item.error})`).join("; ")}`;
        setError(uploadMessage);
        setSubmissionNotice({ tone: "error", text: `Not sent: ${uploadMessage}` });
        return null;
      }
      return {
        ...saved,
        uploadedAttachmentIds: uploadResult.uploaded.map((item) => item.attachment?.id).filter(Boolean),
      };
    } catch (actionError) {
      const saveMessage = saved?.id
        ? `The draft was saved, but its files could not be uploaded: ${actionError.message || String(actionError)}`
        : actionError.message || String(actionError);
      setError(saveMessage);
      setSubmissionNotice({ tone: "error", text: `Not sent: ${saveMessage}` });
      return null;
    } finally { setBusy(false); setUploadProgress(""); }
  };

  const submit = async () => {
    const validation = validateProposalRequest(draft);
    if (!validation.valid) {
      const validationMessage = `Complete these required fields before submitting: ${validation.missing.join(", ")}`;
      setError(validationMessage);
      setSubmissionNotice({ tone: "error", text: `Not sent: ${validationMessage}` });
      return;
    }
    setSubmissionNotice({ tone: "", text: "" });
    const saved = await saveDraft();
    if (!saved?.id) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.rpc("submit_proposal_request", { p_request_id: saved.id });
      if (result.error) throw result.error;
      if (saved.status === "draft" && saved.uploadedAttachmentIds?.length) {
        const notification = await supabase.rpc("notify_proposal_attachment_batch", {
          p_request_id: saved.id,
          p_attachment_ids: saved.uploadedAttachmentIds,
        });
        if (notification.error) {
          setError(`The request was submitted, but the attachment notification could not be sent: ${notification.error.message}`);
        }
      }
      const successMessage = draft.priority === "rush"
        ? "Sent — Rush approval requested."
        : "Sent — Proposal Request successfully submitted to Daniela.";
      setSubmissionNotice({ tone: "success", text: "Sent ✓" });
      setMessage(successMessage);
      await load();
      window.setTimeout(() => {
        setView("queue");
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      }, 650);
    } catch (submitError) {
      const submitMessage = submitError.message || String(submitError);
      setError(`Proposal Request was not sent: ${submitMessage}`);
      setSubmissionNotice({ tone: "error", text: `Not sent: ${submitMessage}` });
    } finally {
      setBusy(false);
    }
  };

  const sendQuickInspectionHandoff = async () => {
    if (inspectionText.trim() && !inspectionExtraction) {
      setError("Press Organize Inspection and review the result before sending this PLAUD transcript.");
      return;
    }
    if (inspectionExtraction && !inspectionConfirmationValid) {
      setError("Confirm that the organized inspection accurately reflects what you observed before sending it to Daniela.");
      return;
    }
    const validation = validateQuickInspectionHandoff(draft);
    if (!validation.valid) {
      setError(`Add these field essentials before sending: ${validation.missing.join(", ")}`);
      return;
    }
    if (!danielaProfile?.id) {
      setError("Daniela's active employee profile could not be found. The handoff has not been sent.");
      return;
    }
    const quickPayload = {
      ...draft,
      salesperson_id: draft.salesperson_id || authUser.key,
      assigned_estimator_id: danielaProfile.id,
      property_name: String(draft.property_name || draft.customer_name || "").trim(),
      salesperson_notes: [
        String(draft.salesperson_notes || "").trim(),
        pendingDraftProposalFiles.length
          ? "The field inspector supplied a drafted proposal for Daniela to review, correct, and complete."
          : "Created from a Quick Inspection Handoff. Complete the full Proposal Request before formal submission.",
      ].filter(Boolean).join("\n\n"),
    };
    const saved = await saveDraft(quickPayload);
    if (!saved?.id) return;
    if (inspectionExtraction) {
      const confirmedResult = await supabase.rpc("save_confirmed_inspection_extraction", {
        p_request_id: saved.id,
        p_transcript: inspectionText.trim(),
        p_summary: inspectionExtraction.summary || "",
        p_extraction: inspectionExtraction,
        p_confirmed: inspectionConfirmationValid,
      });
      if (confirmedResult.error) {
        setError(`The draft was saved, but the confirmed inspection packet could not be attached: ${confirmedResult.error.message}`);
        return;
      }
    }
    const draftUpload = pendingDraftProposalFiles.length
      ? await uploadFilesToRequest(saved.id, pendingDraftProposalFiles, "customer_document")
      : { uploaded: [], failed: [] };
    setPendingDraftProposalFiles(draftUpload.failed.map((item) => item.file));
    if (draftUpload.failed.length) {
      setError(`The handoff was saved, but the draft proposal was not sent because ${draftUpload.failed.map((item) => `${item.file.name}: ${item.error}`).join("; ")}`);
      return;
    }
    const notification = await supabase.rpc("submit_draft_proposal_handoff", {
      p_request_id: saved.id,
      p_has_draft_proposal: draftUpload.uploaded.length > 0,
    });
    if (notification.error) {
      setError(`The draft was saved, but the handoff was not sent to Daniela: ${notification.error.message}`);
      return;
    }
    setPendingDraftProposalFiles([]);
    setInspectionText(""); setInspectionExtraction(null); setInspectionConfirmed(false); setInspectionConfirmedFingerprint("");
    setMessage(draftUpload.uploaded.length
      ? "Draft proposal sent to Daniela for review. The estimating SLA starts only after Daniela accepts it."
      : "Quick inspection handoff sent to Daniela. The estimating SLA starts only after Daniela accepts it.");
    setView("queue");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const openRequest = (request) => {
    setSelectedId(request.id); setDraft({ ...blankDraft(authUser.key), ...request });
    setPendingAttachments([]);
    setManagementDraft({ estimatorId: request.assigned_estimator_id || "", priority: request.priority || "normal", targetAt: request.target_completion_at ? String(request.target_completion_at).slice(0, 16) : "" });
    setCommentDraft(""); setView("detail"); setError(""); setMessage("");
  };
  const newRequest = () => { setSelectedId(""); setDraft(blankDraft(authUser.key)); setPendingAttachments([]); setPendingDraftProposalFiles([]); setSubmissionNotice({ tone: "", text: "" }); setView("form"); };
  const newQuickHandoff = () => {
    setSelectedId("");
    setDraft({ ...blankDraft(authUser.key), assigned_estimator_id: danielaProfile?.id || "" });
    setPendingAttachments([]);
    setPendingDraftProposalFiles([]);
    setInspectionText("");
    setInspectionExtraction(null);
    setInspectionConfirmed(false);
    setInspectionConfirmedFingerprint("");
    setView("quick");
    setError("");
    setMessage("");
  };

  const applyCrmLead = (leadId) => {
    const lead = crmLeads.find((item) => item.id === leadId);
    if (!lead) {
      setDraft((current) => ({ ...current, source_lead_id: "", existing_lead_job_id: "" }));
      return;
    }
    const contactName = String(lead.contact_name || "").trim();
    const nameParts = contactName.split(/\s+/).filter(Boolean);
    setDraft((current) => ({
      ...current,
      source_lead_id: lead.id,
      existing_lead_job_id: lead.id,
      customer_name: current.customer_name || lead.company_name || contactName,
      property_name: current.property_name || lead.company_name || lead.property_address || contactName,
      service_address: current.service_address || [lead.property_address, lead.city, lead.zip_code].filter(Boolean).join(", "),
      customer_contact: current.customer_contact || lead.quick_note || "",
      project_contact_first_name: current.project_contact_first_name || nameParts[0] || "",
      project_contact_last_name: current.project_contact_last_name || nameParts.slice(1).join(" "),
      project_contact_phone: current.project_contact_phone || lead.phone || "",
      project_contact_email: current.project_contact_email || lead.email || "",
      work_type: current.work_type || lead.service_needed || "",
    }));
  };

  const queue = useMemo(() => requests.filter((request) => {
    const search = filters.search.toLowerCase();
    return (filters.status === "all" || request.status === filters.status)
      && (filters.priority === "all" || request.priority === filters.priority)
      && (filters.salesperson === "all" || request.salesperson_id === filters.salesperson)
      && (filters.jobType === "all" || request.job_type === filters.jobType)
      && (!search || [request.customer_name, request.property_name, request.service_address].join(" ").toLowerCase().includes(search));
  }).sort((a, b) => {
    if (filters.sort === "priority") return ({ rush: 0, high: 1, normal: 2 }[a.priority] ?? 3) - ({ rush: 0, high: 1, normal: 2 }[b.priority] ?? 3);
    if (filters.sort === "submitted") return new Date(b.submitted_at || b.draft_handoff_submitted_at || b.created_at) - new Date(a.submitted_at || a.draft_handoff_submitted_at || a.created_at);
    return new Date(a.target_completion_at || "9999-12-31") - new Date(b.target_completion_at || "9999-12-31");
  }), [filters, requests]);

  const addPendingAttachments = (files) => {
    const invalid = files.map(validateProposalRequestAttachment).filter(Boolean);
    if (invalid.length) setError(invalid.join(" "));
    const valid = files.filter((file) => !validateProposalRequestAttachment(file));
    setPendingAttachments((current) => [...current, ...valid.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified))]);
  };

  const addPendingDraftProposalFiles = (files) => {
    const supported = files.filter((file) => /\.(pdf|doc|docx)$/i.test(String(file.name || "")));
    if (supported.length !== files.length) setError("Draft proposals must be PDF or Word documents (.pdf, .doc, or .docx).");
    const invalid = supported.map(validateProposalRequestAttachment).filter(Boolean);
    if (invalid.length) setError(invalid.join(" "));
    const valid = supported.filter((file) => !validateProposalRequestAttachment(file));
    setPendingDraftProposalFiles((current) => [...current, ...valid.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified))]);
  };

  const uploadAttachments = async (files) => {
    if (!files.length || !selectedId) return;
    const invalid = files.map(validateProposalRequestAttachment).find(Boolean);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await uploadFilesToRequest(selectedId, files);
      if (result.uploaded.length) setMessage(`${result.uploaded.length} attachment${result.uploaded.length === 1 ? "" : "s"} uploaded.`);
      if (result.failed.length) setError(`${result.failed.length} file${result.failed.length === 1 ? "" : "s"} failed: ${result.failed.map((item) => `${item.file.name} (${item.error})`).join("; ")}`);
      await load();
    } finally {
      setBusy(false); setUploadProgress("");
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

  const addComment = async () => {
    const body = commentDraft.trim();
    if (!selectedId || !body) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await supabase.rpc("add_proposal_request_comment", {
        p_request_id: selectedId,
        p_body: body,
      });
      if (result.error) throw result.error;
      setCommentDraft("");
      setMessage("Comment added and the other proposal participant was notified by email.");
      await load();
    } catch (commentError) {
      setError(`Comment was not sent: ${commentError.message || String(commentError)}`);
    } finally {
      setBusy(false);
    }
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

  const markProposalApprovedAndSent = async () => {
    if (!latestVersion?.id || !latestVersion.sales_approved_at || latestVersion.sent_at) return;
    const confirmed = window.confirm("Confirm that the salesperson approved this proposal and that the final PDF was sent to the customer.");
    if (!confirmed) return;
    await run(
      () => supabase.rpc("mark_external_proposal_sent", { p_version_id: latestVersion.id }),
      "Proposal approved and sent to customer. Daniela's completion timestamp was recorded for KPI tracking.",
    );
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
    <ActionFeedback message={error || message} tone={error ? "error" : "success"} onDismiss={() => { setError(""); setMessage(""); }} />
    <div className="proposalRequestTopbar">
      <div><p className="eyebrow">Centralized Estimating</p><h2>Proposal Requests</h2><p>Complete scope in, authorized production scope out.</p></div>
      <div className="proposalRequestActions"><button type="button" className="secondaryButton" onClick={() => setView("queue")}>Queue</button>{canCreateQuickHandoff ? <button type="button" className="secondaryButton" onClick={newQuickHandoff}>Quick Inspection Handoff</button> : null}<button type="button" className="primaryButton" onClick={newRequest}>New Proposal Request</button></div>
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
        <span className={`proposalStatus ${request.draft_handoff_status === "awaiting_review" ? "handoff_review" : request.status}`}>{requestStatusLabel(request)}</span><span className={`proposalPriority ${request.priority}`}>{request.priority}</span>
        <strong>PR-{request.request_number} · {request.property_name || "Untitled job"}</strong><p>{request.customer_name} · {request.service_address}</p>
        <small>Sales: {profiles.find((p) => p.id === request.salesperson_id)?.full_name || "Unassigned"} · Submitted: {dateTime(request.submitted_at || request.draft_handoff_submitted_at)} · <b>{request.draft_handoff_status === "awaiting_review" ? "SLA not started" : sla.label}</b></small>
      </button>; })}{!queue.length ? <p className="emptyState">No Proposal Requests match this view.</p> : null}</div>
    </> : null}

    {view === "quick" ? <form className="proposalRequestForm" onSubmit={(event) => { event.preventDefault(); void sendQuickInspectionHandoff(); }}>
      <section className="panel">
        <p className="eyebrow">Mobile Field Shortcut</p>
        <h3>Quick Inspection Handoff</h3>
        <p>Use a PLAUD summary or transcript to organize the field facts, then review and confirm them before sending. Daniela receives the handoff immediately, but her estimating SLA begins only after she accepts it.</p>
        <div className="proposalAiIntake">
          <div className="sectionHead"><div><p className="eyebrow">Voice-First Closeout</p><h4>Organize PLAUD Inspection</h4></div><span className="proposalAiPrivacy">Transcript + job contact only · no photos, documents, or pricing sent to AI</span></div>
          <label className="proposalWide"><span>Paste PLAUD summary or transcript</span><textarea rows="8" value={inspectionText} onChange={(event) => { setInspectionText(event.target.value); setInspectionExtraction(null); setInspectionConfirmed(false); setInspectionConfirmedFingerprint(""); }} placeholder="Paste the inspector's PLAUD summary or transcript here…" /></label>
          <div className="proposalRequestActions">
            <label className="secondaryButton proposalTextUpload">Upload PLAUD Text<input type="file" accept=".txt,.md,.json,text/plain,application/json" onChange={(event) => void loadInspectionTextFile(event)} disabled={inspectionBusy || busy} /></label>
            <button type="button" className="primaryButton" onClick={() => void organizeInspectionText()} disabled={inspectionBusy || busy || inspectionText.trim().length < 40}>{inspectionBusy ? "Organizing…" : inspectionExtraction ? "Organize Again" : "Organize Inspection"}</button>
          </div>
          {inspectionExtraction ? <div className="proposalAiReview">
            <div className="proposalAiSummary"><strong>Estimator summary</strong><p>{inspectionExtraction.summary || "The transcript was organized into the fields below."}</p></div>
            <div className="proposalAiStatusGrid">
              <div className={inspectionReadiness.ready ? "ready" : "missing"}><strong>{inspectionReadiness.ready ? "Critical facts found" : "Still required"}</strong>{inspectionReadiness.ready ? <p>Customer, address, scope, and measurements are ready for review.</p> : <ul>{inspectionReadiness.missing.map((item) => <li key={item}>{item}</li>)}</ul>}</div>
              <div className={inspectionExtraction.needs_confirmation.length ? "confirm" : "ready"}><strong>Needs inspector attention</strong>{inspectionExtraction.needs_confirmation.length ? <ul>{inspectionExtraction.needs_confirmation.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No uncertainty was flagged.</p>}</div>
            </div>
            <details><summary>See extracted facts and supporting transcript phrases</summary><div className="proposalAiFacts">{inspectionExtraction.fields.map((item) => <div key={item.key}><span>{INSPECTION_HANDOFF_FIELD_LABELS[item.key] || labelize(item.key)} · {item.confidence} confidence</span><strong>{item.value}</strong><small>Source: {item.evidence || "No supporting phrase returned—verify carefully."}</small></div>)}</div></details>
            <label className="proposalAcknowledgement"><input type="checkbox" checked={inspectionConfirmationValid} disabled={!inspectionReadiness.ready} onChange={(event) => { setInspectionConfirmed(event.target.checked); setInspectionConfirmedFingerprint(event.target.checked ? inspectionFingerprint : ""); }} /><span><strong>I reviewed the organized inspection.</strong><br />I confirm it accurately reflects what I observed and discussed. I corrected any errors in the fields below.{inspectionConfirmed && !inspectionConfirmationValid ? <><br /><b>Information changed—please review and confirm again.</b></> : null}</span></label>
          </div> : null}
        </div>
        <h4>Review field facts</h4>
        <p className="smallNote">The organizer fills these fields. The inspector can correct any value before confirming and sending.</p>
        <div className="proposalFieldGrid">
          {isManager ? <label className="proposalWide"><span>Assigned salesperson / account owner *</span><select value={draft.salesperson_id || authUser.key} onChange={(event) => setDraft((current) => ({ ...current, salesperson_id: event.target.value }))}>{profiles.filter((profile) => ["salesperson", "admin", "cfo"].includes(String(profile.role || "").toLowerCase())).map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.email}</option>)}</select><small>Select yourself when this is your customer. This keeps ownership and KPI attribution accurate.</small></label> : null}
          <label className="proposalWide"><span>Source CRM lead</span><select value={draft.source_lead_id || draft.existing_lead_job_id || ""} onChange={(event) => applyCrmLead(event.target.value)}><option value="">No linked lead — manual handoff</option>{crmLeads.filter((lead) => !["Lost", "Not Qualified"].includes(lead.status)).map((lead) => <option key={lead.id} value={lead.id}>{lead.contact_name || lead.company_name || lead.property_address || "Untitled lead"}</option>)}</select></label>
          <label><span>Customer / job name *</span><input autoFocus value={draft.customer_name || ""} onChange={(event) => setDraft((current) => ({ ...current, customer_name: event.target.value, property_name: current.property_name || event.target.value }))} /></label>
          <label><span>Service address *</span><input value={draft.service_address || ""} onChange={(event) => setDraft((current) => ({ ...current, service_address: event.target.value }))} /></label>
          <label><span>Contact first name</span><input value={draft.project_contact_first_name || ""} onChange={(event) => setDraft((current) => ({ ...current, project_contact_first_name: event.target.value }))} /></label>
          <label><span>Contact last name</span><input value={draft.project_contact_last_name || ""} onChange={(event) => setDraft((current) => ({ ...current, project_contact_last_name: event.target.value }))} /></label>
          <label><span>Contact phone</span><input type="tel" value={draft.project_contact_phone || ""} onChange={(event) => setDraft((current) => ({ ...current, project_contact_phone: event.target.value }))} /></label>
          <label><span>Contact email</span><input type="email" value={draft.project_contact_email || ""} onChange={(event) => setDraft((current) => ({ ...current, project_contact_email: event.target.value }))} /></label>
          <label><span>Work type</span><input value={draft.work_type || ""} onChange={(event) => setDraft((current) => ({ ...current, work_type: event.target.value }))} placeholder="Repair, TPO, SPF, tile, coating…" /></label>
          <label><span>Measurements / squares *</span><input value={draft.measurements || ""} onChange={(event) => setDraft((current) => ({ ...current, measurements: event.target.value }))} placeholder="Example: 24 SQ plus 180 LF parapet" /></label>
          <label className="proposalWide"><span>Main scope observed *</span><textarea rows="4" value={draft.scope_of_work || ""} onChange={(event) => setDraft((current) => ({ ...current, scope_of_work: event.target.value }))} placeholder="Dictate what you saw, what the customer needs, and the recommended system or repair." /></label>
          <label className="proposalWide"><span>Roof measurement notes</span><textarea rows="3" value={draft.roof_measurement_notes || ""} onChange={(event) => setDraft((current) => ({ ...current, roof_measurement_notes: event.target.value }))} placeholder="Sections, linear feet, layers, penetrations, parapets…" /></label>
          <label className="proposalWide"><span>Risks, access, or special conditions</span><textarea rows="3" value={draft.special_conditions || ""} onChange={(event) => setDraft((current) => ({ ...current, special_conditions: event.target.value }))} placeholder="Roof access, overspray, parking, HVAC, crane, permits…" /></label>
          <label className="proposalWide"><span>Customer requests or verbal commitments</span><textarea rows="3" value={draft.customer_requests || ""} onChange={(event) => setDraft((current) => ({ ...current, customer_requests: event.target.value }))} /></label>
          <label><span>Customer deadline</span><input type="date" value={draft.customer_deadline || ""} onChange={(event) => setDraft((current) => ({ ...current, customer_deadline: event.target.value }))} /></label>
          <label><span>Priority</span><select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}>{PROPOSAL_REQUEST_PRIORITIES.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
      </section>
      <section className="panel proposalDraftUpload">
        <p className="eyebrow">Optional Fast Track</p>
        <h3>Upload Inspector's Draft Proposal</h3>
        <p>Attach the proposal you already drafted. Daniela will review it, correct or complete it, and create the controlled final version. PDF and Word files are accepted.</p>
        <FileDropZone accept={DRAFT_PROPOSAL_FILE_ACCEPT} label={pendingDraftProposalFiles.length ? "Add Another Draft Proposal" : "Choose Draft Proposal PDF or Word File"} help="PDF, DOC, or DOCX — up to 25 MB each." onFiles={addPendingDraftProposalFiles} disabled={busy} />
        {pendingDraftProposalFiles.length ? <div className="proposalPendingFiles"><strong>Draft proposal ready to send:</strong>{pendingDraftProposalFiles.map((file, index) => <div key={`${file.name}-${file.size}-${file.lastModified}`}><span>{file.name}</span><button type="button" className="secondaryButton" onClick={() => setPendingDraftProposalFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div> : <p className="emptyState">No draft proposal attached. You can still send the inspection handoff with field notes and photos.</p>}
      </section>
      <section className="panel proposalIntakeAttachments">
        <h3>Roof photos &amp; field files</h3>
        <p>Select, photograph, paste, or drop multiple photos and reports. Files upload into the same protected Proposal Request folder.</p>
        <FileDropZone accept={PROPOSAL_REQUEST_FILE_ACCEPT} label={pendingAttachments.length ? "Add More Photos & Files" : "Add Roof Photos & Files"} help="Multiple photos and documents are supported." onFiles={addPendingAttachments} disabled={busy} />
        {pendingAttachments.length ? <div className="proposalPendingFiles"><strong>Ready to send:</strong>{pendingAttachments.map((file, index) => <div key={`${file.name}-${file.size}-${file.lastModified}`}><span>{file.name}</span><button type="button" className="secondaryButton" onClick={() => setPendingAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div> : <p className="emptyState">No photos or files selected yet.</p>}
      </section>
      <div className="proposalStickyActions"><button type="button" className="secondaryButton" disabled={busy} onClick={() => setView("queue")}>Cancel</button><button type="submit" className="primaryButton" disabled={busy || inspectionBusy || Boolean(inspectionExtraction && !inspectionConfirmationValid)}>{busy ? "Sending…" : inspectionExtraction && !inspectionConfirmationValid ? "Confirm Inspection First" : "Send Quick Handoff to Daniela"}</button></div>
    </form> : null}

    {view === "form" ? <form className="proposalRequestForm" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <section className="panel"><h3>Request setup</h3><div className="proposalFieldGrid">
        <label className="proposalWide"><span>Source CRM lead</span><select value={draft.source_lead_id || draft.existing_lead_job_id || ""} onChange={(e) => applyCrmLead(e.target.value)}><option value="">No linked lead — manual request</option>{crmLeads.filter((lead) => !["Lost", "Not Qualified"].includes(lead.status)).map((lead) => <option key={lead.id} value={lead.id}>{lead.contact_name || lead.company_name || lead.property_address || "Untitled lead"} · Originated by {lead.originator_name || lead.originator_email || "Unknown"}</option>)}</select></label>
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
        <FileDropZone accept={PROPOSAL_REQUEST_FILE_ACCEPT} label={pendingAttachments.length ? "Add More Photos & Files" : "Choose Photos & Files"} help="You can select, drop, or paste multiple files at once." onFiles={addPendingAttachments} disabled={busy} />
        {uploadProgress ? <p className="proposalUploadProgress" role="status">{uploadProgress}</p> : null}
        {pendingAttachments.length ? <div className="proposalPendingFiles"><strong>Ready to upload when you save or submit:</strong>{pendingAttachments.map((file, index) => <div key={`${file.name}-${file.size}-${file.lastModified}`}><span>{file.name}</span><button type="button" className="secondaryButton" onClick={() => setPendingAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div> : <p className="emptyState">No new files selected.</p>}
        {selectedAttachments.length ? <div className="proposalDocumentLinks"><strong>Already uploaded:</strong>{selectedAttachments.map((item) => <button type="button" className="secondaryButton" key={item.id} onClick={() => void openDocument(item.storage_path)}>Open {item.file_name}</button>)}</div> : null}
      </section>
      <div className="proposalStickyActions">{submissionNotice.text ? <p className={`proposalSubmitNotice ${submissionNotice.tone}`} role="status" aria-live="polite">{submissionNotice.text}</p> : null}<button type="button" className="secondaryButton" disabled={busy} onClick={() => void saveDraft()}>Save Draft</button><button type="submit" className="primaryButton" disabled={busy || submissionNotice.tone === "success"}>{busy ? "Sending…" : submissionNotice.tone === "success" ? "Sent ✓" : draft.status === "missing_information" ? "Resubmit Complete Request" : "Submit to Daniela"}</button></div>
    </form> : null}

    {view === "detail" && selected ? <div className="proposalDetail">
      <section className="panel proposalDetailHeader"><div><p className="eyebrow">PR-{selected.request_number}</p><h3>{selected.property_name}</h3><p>{selected.customer_name} · {selected.service_address}</p></div><div><span className={`proposalStatus ${selected.draft_handoff_status === "awaiting_review" ? "handoff_review" : selected.status}`}>{requestStatusLabel(selected)}</span><p>{selected.draft_handoff_status === "awaiting_review" ? "Awaiting Daniela's review — SLA not started" : getSlaDisplay(selected).label}</p>{["draft","missing_information"].includes(selected.status) && selected.salesperson_id === authUser.key ? <button type="button" className="primaryButton" onClick={() => setView("form")}>Complete Full Request</button> : null}</div></section>
      {selected.missing_information_notes ? <section className="panel proposalMissing"><h3>Missing information requested</h3><p>{selected.missing_information_notes}</p><button type="button" className="primaryButton" onClick={() => setView("form")}>Update request</button></section> : null}
      <section className="panel"><h3>Timing & responsibility</h3><div className="proposalFacts"><span>Submitted <b>{dateTime(selected.submitted_at || selected.draft_handoff_submitted_at)}</b></span><span>Target <b>{selected.draft_handoff_status === "awaiting_review" ? "Starts when Daniela accepts" : dateTime(selected.target_completion_at)}</b></span><span>Priority <b>{labelize(selected.priority)}</b></span><span>Estimator <b>{profiles.find((p) => p.id === selected.assigned_estimator_id)?.full_name || "Daniela"}</b></span></div></section>
      {selected.inspection_confirmed_at ? <section className="panel proposalAiPacket">
        <div className="sectionHead"><div><p className="eyebrow">Inspector-Confirmed Field Evidence</p><h3>PLAUD Inspection Packet</h3></div><span className="proposalStatus signed">Confirmed by {inspectionConfirmerName} · {dateTime(selected.inspection_confirmed_at)}</span></div>
        <p className="proposalAiPacketSummary">{selected.inspection_summary || "The inspector confirmed the structured field facts below."}</p>
        <div className="proposalAiFacts">{(selected.inspection_extraction?.fields || []).map((item) => <div key={item.key}><span>{INSPECTION_HANDOFF_FIELD_LABELS[item.key] || labelize(item.key)} · {item.confidence || "unrated"} confidence</span><strong>{item.value}</strong><small>Source: {item.evidence || "Review the original transcript."}</small></div>)}</div>
        {(selected.inspection_extraction?.missing_critical || []).length ? <div className="proposalAiWarning"><strong>Extractor flagged missing information</strong><ul>{selected.inspection_extraction.missing_critical.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        <details><summary>Original PLAUD summary or transcript</summary><pre className="proposalTranscript">{selected.inspection_transcript}</pre></details>
      </section> : null}
      <section className="panel proposalSubmittedDetails"><div className="sectionHead"><div><h3>Submitted Request Details</h3><p>The complete information submitted by the salesperson for Daniela's review.</p></div>{isEstimator ? <div className="proposalRequestActions"><button type="button" className="secondaryButton" disabled={Boolean(exportBusy)} onClick={exportPdf}>Download Proposal Info PDF</button><button type="button" className="primaryButton" disabled={Boolean(exportBusy)} onClick={() => void exportZip()}>{exportBusy === "zip" ? "Preparing ZIP..." : "Download Complete ZIP"}</button></div> : null}</div>
        <details open><summary>Request setup</summary><div className="proposalReadOnlyGrid">
          <div><span>Lead originated by</span><strong>{selected.lead_originator_name || selected.lead_originator_email || "Not linked to a CRM lead"}</strong></div>
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
      {isEstimator && selected.draft_handoff_status !== "accepted" && ["submitted","under_review"].includes(selected.status) ? <section className="panel"><h3>Estimator review</h3><div className="proposalRequestActions"><button type="button" className="primaryButton" disabled={busy} onClick={() => run(() => supabase.rpc("review_proposal_request", { p_request_id: selected.id, p_action: "accept", p_missing_notes: "", p_target_at: selected.target_completion_at }), "Accepted into the estimating queue.")}>Accept into queue</button><input value={missingNotes} onChange={(e) => setMissingNotes(e.target.value)} placeholder="Describe exactly what is missing" /><button type="button" className="secondaryButton" disabled={busy || !missingNotes.trim()} onClick={() => run(() => supabase.rpc("review_proposal_request", { p_request_id: selected.id, p_action: "missing_information", p_missing_notes: missingNotes, p_target_at: null }), "Returned to salesperson; SLA paused.")}>Request information</button></div></section> : null}
      {isEstimator && selected.draft_handoff_status === "awaiting_review" ? <section className="panel proposalDraftReview"><p className="eyebrow">Pre-Queue Review</p><h3>{selected.intake_mode === "draft_proposal" ? "Review Ivan's Draft Proposal" : "Review Inspection Handoff"}</h3><p>Accept only when the uploaded draft, field notes, and supporting files give you enough information to begin. Acceptance starts the estimating SLA. Otherwise, describe exactly what Ivan still needs to provide.</p><div className="proposalRequestActions"><button type="button" className="primaryButton" disabled={busy} onClick={() => run(() => supabase.rpc("review_draft_proposal_handoff", { p_request_id: selected.id, p_action: "accept", p_missing_notes: "", p_target_at: managementDraft.targetAt || null }), "Handoff accepted. The estimating SLA has started.")}>Accept &amp; Start Estimating</button><input value={missingNotes} onChange={(e) => setMissingNotes(e.target.value)} placeholder="What information is still missing?" /><button type="button" className="secondaryButton" disabled={busy || !missingNotes.trim()} onClick={() => run(() => supabase.rpc("review_draft_proposal_handoff", { p_request_id: selected.id, p_action: "missing_information", p_missing_notes: missingNotes, p_target_at: null }), "Returned to Ivan for missing information; SLA has not started.")}>Request Information</button></div></section> : null}
      {isEstimator && selected.draft_handoff_status === "accepted" && selected.status === "under_review" ? <section className="panel"><h3>Accepted Draft Handoff</h3><p>Estimating is underway. If a material gap is discovered, return it to Ivan with a specific request and pause the SLA.</p><div className="proposalRequestActions"><input value={missingNotes} onChange={(e) => setMissingNotes(e.target.value)} placeholder="Describe the newly discovered missing information" /><button type="button" className="secondaryButton" disabled={busy || !missingNotes.trim()} onClick={() => run(() => supabase.rpc("review_proposal_request", { p_request_id: selected.id, p_action: "missing_information", p_missing_notes: missingNotes, p_target_at: null }), "Returned to Ivan; SLA paused.")}>Return for Information</button></div></section> : null}
      {isManager && selected.priority === "rush" && selected.rush_approval_status === "pending" ? <section className="panel"><h3>Rush approval</h3><div className="proposalRequestActions"><button className="primaryButton" onClick={() => run(() => supabase.rpc("approve_rush_proposal_request", { p_request_id: selected.id, p_approved: true, p_notes: "" }), "Rush approved.")}>Approve Rush</button><button className="secondaryButton" onClick={() => run(() => supabase.rpc("approve_rush_proposal_request", { p_request_id: selected.id, p_approved: false, p_notes: "" }), "Rush rejected; priority set to High.")}>Reject Rush</button></div></section> : null}
      <section className="panel proposalConversation">
        <div className="proposalConversationHeader"><div><h3>Proposal conversation</h3><p>Comments stay with this request. Daniela and the requesting salesperson receive each other’s comments by email.</p></div><span>{selectedComments.length} comment{selectedComments.length === 1 ? "" : "s"}</span></div>
        <div className="proposalCommentThread">
          {selectedComments.length ? selectedComments.map((comment) => {
            const author = profiles.find((profile) => profile.id === comment.author_id);
            const isMine = comment.author_id === authUser.key;
            return <article className={isMine ? "mine" : ""} key={comment.id}><div><strong>{isMine ? "You" : author?.full_name || author?.email || "Team member"}</strong><time>{dateTime(comment.created_at)}</time></div><p>{comment.body}</p></article>;
          }) : <p className="emptyState">No comments yet. Start the conversation here instead of using a separate email thread.</p>}
        </div>
        <label className="proposalCommentComposer"><span>Add a comment</span><textarea rows="3" maxLength="4000" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Question, clarification, update, or response for this proposal…" /></label>
        <div className="proposalRequestActions"><small>{commentDraft.length}/4000</small><button type="button" className="primaryButton" disabled={busy || !commentDraft.trim()} onClick={() => void addComment()}>{busy ? "Sending…" : "Add Comment & Notify"}</button></div>
      </section>
      <section className="panel proposalIntakeAttachments"><h3>Documentation / attachments</h3><FileDropZone accept={PROPOSAL_REQUEST_FILE_ACCEPT} label="Add Photos & Files" help="Drop or paste multiple photos and documents here." onFiles={uploadAttachments} disabled={busy} /> <small>{selectedAttachments.length} file(s) attached</small>{uploadProgress ? <p className="proposalUploadProgress" role="status">{uploadProgress}</p> : null}{selectedAttachments.length ? <div className="proposalDocumentLinks">{selectedAttachments.map((item) => <button type="button" className="secondaryButton" key={item.id} onClick={() => void openDocument(item.storage_path)}>Open {item.file_name}</button>)}</div> : <p className="emptyState">No supporting files were attached.</p>}</section>
      {isEstimator ? <section className="panel"><h3>Proposal documents</h3><p>Prepare the proposal in Microsoft Word. Upload the working Word file as the editable source, then upload the finalized PDF for Sales Review. The app tracks the workflow and documents; it does not build the proposal.</p><label className="proposalWide"><span>Proposal sections / alternates (one per line)</span><textarea rows="5" value={sectionDraft} onChange={(e) => setSectionDraft(e.target.value)} /></label><div className="proposalFieldGrid proposalDocumentInputs"><label><span>Working Word proposal (.docx) *</span><input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setWordFile(e.target.files?.[0] || null)} /></label><label><span>Final customer PDF (required for Sales Review)</span><input type="file" accept=".pdf,application/pdf" onChange={(e) => setFinalPdfFile(e.target.files?.[0] || null)} /></label></div><div className="proposalRequestActions"><button className="secondaryButton" disabled={busy || !wordFile} onClick={() => void saveExternalVersion(false)}>Save Word version</button><button className="primaryButton" disabled={busy || !wordFile || !finalPdfFile} onClick={() => void saveExternalVersion(true)}>Finalize PDF for Sales Review</button></div></section> : null}
      {latestVersion ? <section className="panel"><h3>Proposal document version {latestVersion.version_number}</h3><div className="proposalDocumentLinks">{latestVersion.source_document_storage_path ? <button className="secondaryButton" onClick={() => void openDocument(latestVersion.source_document_storage_path)}>Open Word: {latestVersion.source_document_file_name}</button> : null}{latestVersion.final_pdf_storage_path ? <button className="secondaryButton" onClick={() => void openDocument(latestVersion.final_pdf_storage_path)}>Open final PDF: {latestVersion.final_pdf_file_name}</button> : null}{latestVersion.signed_pdf_storage_path ? <button className="secondaryButton" onClick={() => void openDocument(latestVersion.signed_pdf_storage_path)}>Open signed PDF: {latestVersion.signed_pdf_file_name}</button> : null}</div><div className="proposalSections">{(latestVersion.sections || []).map((section) => <div key={section.id} className={section.customer_approved ? "authorized" : ""}><strong>{section.title}</strong><p>{section.scope}</p><span>{section.customer_approved ? "APPROVED" : latestVersion.customer_decision === "signed" ? "NOT APPROVED" : "Pending customer selection"}</span></div>)}</div>
        {selected.status === "sales_review" && selected.salesperson_id === authUser.key ? <label className="proposalAcknowledgement"><input type="checkbox" onChange={(e) => e.target.checked && run(() => supabase.rpc("approve_proposal_scope", { p_version_id: latestVersion.id, p_acknowledgement: SALES_APPROVAL_ACKNOWLEDGEMENT }), "Scope approved. Daniela may send the proposal.")} />{SALES_APPROVAL_ACKNOWLEDGEMENT}</label> : null}
        {isEstimator && latestVersion.finalized_at ? <div className="proposalCompletionAction">
          {latestVersion.sent_at ? <div className="statusMessage proposalSuccess" role="status"><strong>Proposal approved and sent to customer ✓</strong><span> Completed {dateTime(latestVersion.sent_at)}. This completion is included in Daniela's KPI history.</span></div> : latestVersion.sales_approved_at ? <div><p>The salesperson approved the scope. After Daniela sends the final PDF to the customer, use this button to complete the proposal workflow.</p><button type="button" className="primaryButton" disabled={busy} onClick={() => void markProposalApprovedAndSent()}>Proposal Approved &amp; Sent to Customer</button></div> : <div className="notice"><strong>Waiting for salesperson scope approval</strong><p>Daniela can mark this proposal complete after the assigned salesperson approves the final scope and the proposal is sent to the customer.</p><button type="button" className="primaryButton" disabled>Proposal Approved &amp; Sent to Customer</button></div>}
        </div> : null}
        {isEstimator && latestVersion.sent_at && latestVersion.customer_decision === "pending" ? <div className="proposalSignedUpload"><h4>Record signed proposal</h4><p>After the customer signs outside the app, upload the signed PDF and identify exactly which sections were approved.</p><div className="proposalFieldGrid"><label><span>Customer / signer name</span><input value={signerName} onChange={(e) => setSignerName(e.target.value)} /></label><label><span>Signed proposal PDF</span><input type="file" accept=".pdf,application/pdf" onChange={(e) => setSignedPdfFile(e.target.files?.[0] || null)} /></label></div><div className="proposalSectionChoices">{(latestVersion.sections || []).map((section) => <label key={section.id}><input type="checkbox" checked={approvedSectionIds.includes(section.id)} onChange={(e) => setApprovedSectionIds((ids) => e.target.checked ? [...ids, section.id] : ids.filter((id) => id !== section.id))} />{section.title}</label>)}</div><button className="primaryButton" disabled={busy || !signedPdfFile || !signerName.trim() || !approvedSectionIds.length} onClick={() => void recordSignedProposal()}>Record customer signature</button></div> : null}
        {isEstimator && selected.deposit_required && latestVersion.customer_decision === "signed" ? <label className="proposalAcknowledgement"><input type="checkbox" checked={Boolean(selected.deposit_satisfied_at)} onChange={(e) => run(() => supabase.rpc("set_proposal_deposit_satisfied", { p_request_id: selected.id, p_satisfied: e.target.checked }), e.target.checked ? "Deposit condition marked satisfied." : "Deposit condition reopened.")} />Required deposit / payment condition satisfied</label> : null}
        {isEstimator && latestVersion.customer_decision === "signed" && !selected.production_released_at && blockers.length === 0 ? <div className="proposalRequestActions"><button type="button" className="primaryButton" disabled={busy} onClick={() => run(() => supabase.rpc("release_proposal_to_production", { p_request_id: selected.id, p_override_reason: "" }), "Approved job sent to Miguel for scheduling.")}>Send Approved Job to Miguel</button></div> : null}
        {selected.production_released_at ? <div className="statusMessage proposalSuccess" role="status"><strong>Approved job sent to Miguel ✓</strong><span> The signed and authorized scope is ready for scheduling.</span></div> : null}
      </section> : null}
      {isEstimator ? <section className="panel"><h3>Change orders</h3><div className="proposalFieldGrid"><input placeholder="Description" value={changeOrderDraft.description} onChange={(e) => setChangeOrderDraft((d) => ({ ...d, description: e.target.value }))} /><input placeholder="Scope" value={changeOrderDraft.scope} onChange={(e) => setChangeOrderDraft((d) => ({ ...d, scope: e.target.value }))} /><input type="number" placeholder="Price" value={changeOrderDraft.price} onChange={(e) => setChangeOrderDraft((d) => ({ ...d, price: e.target.value }))} /><button className="secondaryButton" onClick={() => run(() => supabase.rpc("save_proposal_change_order", { p_request_id: selected.id, p_description: changeOrderDraft.description, p_scope: changeOrderDraft.scope, p_price: changeOrderDraft.price || 0, p_required: changeOrderDraft.required }), "Change order created.")}>Create change order</button></div>{selectedOrders.map((order) => <div className="proposalOrder" key={order.id}><span>{order.description} · {money(order.price)} · {labelize(order.status)}</span>{order.status === "draft" ? <button className="secondaryButton" onClick={() => void createChangeOrderSigningLink(order.id)}>Create signing link</button> : null}</div>)}</section> : null}
      <section className="panel"><h3>Audit history</h3><div className="proposalAudit">{selectedAudit.map((event) => <div key={event.id}><strong>{labelize(event.action)}</strong><span>{dateTime(event.created_at)}</span><p>{event.notes}</p></div>)}</div></section>
      {selected.status !== "closed" && (["signed","declined"].includes(selected.status) || selected.production_released_at) ? <div className="proposalRequestActions"><button type="button" className="secondaryButton" onClick={() => run(() => supabase.rpc("close_proposal_request", { p_request_id: selected.id, p_notes: "Workflow complete" }), "Proposal Request closed.")}>Close completed request</button></div> : null}
    </div> : null}
  </section>;
}
