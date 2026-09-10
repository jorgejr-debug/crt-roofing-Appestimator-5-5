import { useCallback, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import FileDropZone from "./FileDropZone.jsx";
import { INVOICE_REQUEST_STATUSES } from "./invoiceWorkflow.js";

const money = (value) => Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const safeFileName = (value) => String(value || "invoice.pdf").replace(/[^a-zA-Z0-9._-]+/g, "-");
const editableStatuses = INVOICE_REQUEST_STATUSES.filter((status) => !["Sending", "Sent", "Partially Paid", "Paid"].includes(status));
const newLineItem = () => ({ description: "", quantity: 1, unit_price: 0 });
const lineTotal = (items = []) => items.reduce((total, item) => total + Math.max(0, Number(item.quantity || 0)) * Math.max(0, Number(item.unit_price || 0)), 0);
const normalizeLineItems = (request = {}) => Array.isArray(request.line_items) && request.line_items.length
  ? request.line_items.map((item) => ({ description: String(item.description || ""), quantity: Number(item.quantity || 0), unit_price: Number(item.unit_price || 0) }))
  : [{ description: request.project_name || request.job_number || "Roofing services", quantity: 1, unit_price: Number(request.amount_to_invoice || 0) }];

function createDraft(request = {}) {
  const lineItems = normalizeLineItems(request);
  return {
    status: request.status || "Ready for Invoice",
    invoiceNumber: request.invoice_number || "",
    dueDate: request.due_date || "",
    paymentTerms: request.payment_terms || "Due on receipt",
    amountToInvoice: lineTotal(lineItems) || Number(request.amount_to_invoice || 0),
    missingInformationNotes: request.missing_information_notes || "",
    notes: request.notes || "",
    invoiceFileName: request.invoice_file_name || "",
    invoiceStoragePath: request.invoice_storage_path || "",
    lineItems,
  };
}

function createManualDraft() {
  return {
    jobNumber: "", projectName: "", customerName: "", billingContactName: "", billingEmail: "",
    billingAddress: "", purchaseOrderNumber: "", invoiceType: "Final", dueDate: "",
    paymentTerms: "Due on receipt", invoiceNumber: "", notes: "", lineItems: [newLineItem()],
  };
}

function InvoiceLineItems({ items, onChange, disabled = false }) {
  const update = (index, key, value) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  return <div className="panel" style={{ marginTop: 14 }}>
    <div className="sectionHeading"><div><h3>Invoice line items</h3><p>Description, quantity, and price per item.</p></div><strong>{money(lineTotal(items))}</strong></div>
    <div className="savedList">{items.map((item, index) => <div className="savedCard" key={`invoice-line-${index}`}>
      <div className="formGrid">
        <label className="field fieldFull"><span>Description</span><input value={item.description} disabled={disabled} onChange={(event) => update(index, "description", event.target.value)} placeholder="Roofing work or service" /></label>
        <label className="field"><span>Quantity</span><input type="number" min="0" step="0.01" value={item.quantity} disabled={disabled} onChange={(event) => update(index, "quantity", event.target.value)} /></label>
        <label className="field"><span>Price per item</span><input type="number" min="0" step="0.01" value={item.unit_price} disabled={disabled} onChange={(event) => update(index, "unit_price", event.target.value)} /></label>
      </div>
      <div className="actionRow"><strong>Line total: {money(Number(item.quantity || 0) * Number(item.unit_price || 0))}</strong>{items.length > 1 && !disabled ? <button type="button" className="dangerButton" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove line</button> : null}</div>
    </div>)}</div>
    {!disabled ? <button type="button" className="secondaryButton" onClick={() => onChange([...items, newLineItem()])}>Add line item</button> : null}
  </div>;
}

function buildInvoicePdf(request, draft) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const left = 48;
  let y = 52;
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("CRT ROOFING CO.", left, y);
  doc.setFontSize(18); doc.text(`INVOICE ${draft.invoiceNumber || "DRAFT"}`, 564, y, { align: "right" });
  y += 32; doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("18551 Orange St., Bloomington, CA 92316", left, y);
  doc.text("(909) 566-4036  |  CRTRoofing.com", left, y + 15);
  doc.text(`Due date: ${draft.dueDate || "Not set"}`, 564, y, { align: "right" });
  doc.text(`Terms: ${draft.paymentTerms || "Due on receipt"}`, 564, y + 15, { align: "right" });
  y += 54; doc.setDrawColor(160, 205, 235); doc.line(left, y, 564, y); y += 24;
  doc.setFont("helvetica", "bold"); doc.text("BILL TO", left, y); doc.text("JOB", 320, y);
  doc.setFont("helvetica", "normal");
  doc.text(String(request.billing_contact_name || ""), left, y + 17);
  doc.text(String(request.customer_name || ""), left, y + 32);
  doc.text(doc.splitTextToSize(String(request.billing_address || ""), 230), left, y + 47);
  doc.text(String(request.project_name || request.job_number || ""), 320, y + 17);
  doc.text(`Job #: ${request.job_number || "—"}`, 320, y + 32);
  doc.text(`PO / reference: ${request.purchase_order_number || "—"}`, 320, y + 47);
  y += 92;
  doc.setFillColor(225, 243, 255); doc.rect(left, y - 15, 516, 24, "F");
  doc.setFont("helvetica", "bold"); doc.text("DESCRIPTION", left + 6, y); doc.text("QTY", 390, y, { align: "right" }); doc.text("PRICE", 475, y, { align: "right" }); doc.text("TOTAL", 558, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  for (const item of draft.lineItems) {
    y += 28;
    if (y > 700) { doc.addPage(); y = 55; }
    const description = doc.splitTextToSize(String(item.description || ""), 300);
    doc.text(description, left + 6, y);
    doc.text(String(Number(item.quantity || 0)), 390, y, { align: "right" });
    doc.text(money(item.unit_price), 475, y, { align: "right" });
    doc.text(money(Number(item.quantity || 0) * Number(item.unit_price || 0)), 558, y, { align: "right" });
    y += Math.max(0, (description.length - 1) * 12);
    doc.setDrawColor(225, 235, 242); doc.line(left, y + 8, 564, y + 8);
  }
  y += 42; doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(`TOTAL DUE: ${money(lineTotal(draft.lineItems))}`, 564, y, { align: "right" });
  if (draft.notes) { y += 36; doc.setFontSize(10); doc.text("NOTES", left, y); doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(draft.notes, 500), left, y + 16); }
  return doc.output("blob");
}

export default function InvoiceQueue({ supabase, authUser, onClose }) {
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(createDraft());
  const [manualDraft, setManualDraft] = useState(createManualDraft());
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [supportDocuments, setSupportDocuments] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase.from("invoice_requests").select("*").order("submitted_at", { ascending: false });
    if (error) {
      setMessageType("error");
      setMessage(error.message || "Invoice requests could not be loaded.");
    } else {
      setRequests(Array.isArray(data) ? data : []);
      setSelectedId((current) => current || data?.[0]?.id || "");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) return loadRequests();
      return undefined;
    });
    const channel = supabase.channel(`invoice-requests-${authUser?.id || "user"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoice_requests" }, loadRequests)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [authUser?.id, loadRequests, supabase]);

  const selected = requests.find((request) => request.id === selectedId) || null;
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setDraft(createDraft(selected || {}));
      setMessage("");
      if (!selected?.id) {
        setAuditLog([]);
        setSupportDocuments([]);
        return;
      }
      const [auditResult, documentResult] = await Promise.all([
        supabase.from("invoice_request_audit_log").select("*").eq("invoice_request_id", selected.id).order("created_at", { ascending: false }),
        supabase.from("invoice_support_documents").select("*").eq("invoice_request_id", selected.id).order("created_at", { ascending: false }),
      ]);
      if (!cancelled) {
        setAuditLog(Array.isArray(auditResult.data) ? auditResult.data : []);
        setSupportDocuments(Array.isArray(documentResult.data) ? documentResult.data : []);
      }
    });
    return () => { cancelled = true; };
  }, [selectedId, selected, supabase]);

  const visibleRequests = useMemo(() => requests.filter((request) => {
    if (statusFilter === "open" && ["Paid", "Void"].includes(request.status)) return false;
    if (statusFilter !== "all" && statusFilter !== "open" && request.status !== statusFilter) return false;
    const haystack = `${request.job_number} ${request.project_name} ${request.customer_name} ${request.invoice_number}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  }), [requests, search, statusFilter]);

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const updateManualDraft = (key, value) => setManualDraft((current) => ({ ...current, [key]: value }));

  const createManualInvoice = async () => {
    const validItems = manualDraft.lineItems.filter((item) => String(item.description).trim() && Number(item.quantity) > 0 && Number(item.unit_price) >= 0);
    if (!manualDraft.customerName.trim() || !manualDraft.billingContactName.trim() || !/^\S+@\S+\.\S+$/.test(manualDraft.billingEmail.trim()) || !manualDraft.billingAddress.trim() || !manualDraft.dueDate || !validItems.length || lineTotal(validItems) <= 0) {
      setMessageType("error");
      setMessage("Complete the customer, billing contact, billing email, billing address, due date, and at least one priced line item.");
      return;
    }
    setSaving(true);
    setMessage("");
    const { data, error } = await supabase.rpc("create_manual_invoice_request", {
      p_job_number: manualDraft.jobNumber,
      p_project_name: manualDraft.projectName,
      p_customer_name: manualDraft.customerName,
      p_billing_contact_name: manualDraft.billingContactName,
      p_billing_email: manualDraft.billingEmail,
      p_billing_address: manualDraft.billingAddress,
      p_purchase_order_number: manualDraft.purchaseOrderNumber,
      p_invoice_type: manualDraft.invoiceType,
      p_due_date: manualDraft.dueDate,
      p_payment_terms: manualDraft.paymentTerms,
      p_invoice_number: manualDraft.invoiceNumber,
      p_line_items: validItems,
      p_notes: manualDraft.notes,
    });
    setSaving(false);
    if (error) {
      setMessageType("error");
      setMessage(error.message || "Invoice could not be created.");
      return;
    }
    setShowNewInvoice(false);
    setManualDraft(createManualDraft());
    setSelectedId(data.id);
    setMessageType("success");
    setMessage("Invoice created. You can now add supporting documents or generate its PDF.");
    await loadRequests();
  };

  const saveRequest = async (statusOverride = "") => {
    if (!selected) return null;
    const nextStatus = statusOverride || draft.status;
    setSaving(true);
    setMessage("");
    const { data, error } = await supabase.rpc("update_invoice_request", {
      p_request_id: selected.id,
      p_status: nextStatus,
      p_invoice_number: draft.invoiceNumber,
      p_due_date: draft.dueDate || null,
      p_payment_terms: draft.paymentTerms,
      p_amount_to_invoice: lineTotal(draft.lineItems) || Number(draft.amountToInvoice || 0),
      p_missing_information_notes: draft.missingInformationNotes,
      p_notes: draft.notes,
      p_invoice_file_name: draft.invoiceFileName,
      p_invoice_storage_path: draft.invoiceStoragePath,
      p_line_items: draft.lineItems,
    });
    setSaving(false);
    if (error) {
      setMessageType("error");
      setMessage(error.message || "Invoice request could not be saved.");
      return null;
    }
    setMessageType("success");
    setMessage(nextStatus === "Ready to Send" ? "Invoice is ready to send." : "Invoice request saved.");
    await loadRequests();
    return data;
  };

  const storeInvoicePdf = async (file) => {
    if (!selected) return false;
    setSaving(true);
    const path = `${selected.id}/invoice/${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await supabase.storage.from("invoice-documents").upload(path, file, { contentType: "application/pdf", upsert: false });
    setSaving(false);
    if (error) {
      setMessageType("error");
      setMessage(error.message || "Invoice PDF upload failed.");
      return false;
    }
    updateDraft("invoiceFileName", file.name);
    updateDraft("invoiceStoragePath", path);
    setMessageType("success");
    setMessage("Invoice PDF is ready. Click Save Invoice before sending.");
    return true;
  };

  const uploadInvoice = async (files) => {
    const file = files?.[0];
    if (!file || !selected) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMessageType("error");
      setMessage("Please choose the completed invoice as a PDF file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setMessageType("error");
      setMessage("Invoice PDFs must be 15 MB or smaller.");
      return;
    }
    await storeInvoicePdf(file);
  };

  const generateInvoicePdf = async () => {
    if (!selected || !draft.invoiceNumber.trim() || !draft.dueDate || !draft.lineItems.some((item) => String(item.description).trim()) || lineTotal(draft.lineItems) <= 0) {
      setMessageType("error");
      setMessage("Add an invoice number, due date, and priced line items before generating the PDF.");
      return;
    }
    const blob = buildInvoicePdf(selected, draft);
    await storeInvoicePdf(new File([blob], `${safeFileName(draft.invoiceNumber)}.pdf`, { type: "application/pdf" }));
  };

  const uploadSupportDocuments = async (files) => {
    if (!selected || !files.length) return;
    const invalid = files.find((file) => file.size > 25 * 1024 * 1024);
    if (invalid) {
      setMessageType("error");
      setMessage(`${invalid.name} is larger than 25 MB.`);
      return;
    }
    setSaving(true);
    setMessage("");
    for (const file of files) {
      const path = `${selected.id}/support/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("invoice-documents").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (uploadError) {
        setSaving(false); setMessageType("error"); setMessage(uploadError.message || `${file.name} could not be uploaded.`); return;
      }
      const { error: recordError } = await supabase.from("invoice_support_documents").insert({
        invoice_request_id: selected.id, file_name: file.name, storage_path: path,
        content_type: file.type || "application/octet-stream", file_size: file.size, uploaded_by: authUser.key,
      });
      if (recordError) {
        await supabase.storage.from("invoice-documents").remove([path]);
        setSaving(false); setMessageType("error"); setMessage(recordError.message || `${file.name} could not be saved.`); return;
      }
    }
    setSaving(false);
    setMessageType("success");
    setMessage(`${files.length} supporting file${files.length === 1 ? "" : "s"} attached.`);
    const { data } = await supabase.from("invoice_support_documents").select("*").eq("invoice_request_id", selected.id).order("created_at", { ascending: false });
    setSupportDocuments(data || []);
  };

  const openSupportDocument = async (document) => {
    const { data, error } = await supabase.storage.from("invoice-documents").createSignedUrl(document.storage_path, 60);
    if (error || !data?.signedUrl) {
      setMessageType("error");
      setMessage(error?.message || "The document could not be opened.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const sendInvoice = async () => {
    const saved = await saveRequest("Ready to Send");
    if (!saved || !selected) return;
    if (!window.confirm(`Send invoice ${draft.invoiceNumber} to ${selected.billing_email} and CC natalia@crtroofing.com?`)) return;
    setSaving(true);
    setMessage("");
    const { data, error } = await supabase.functions.invoke("send-customer-invoice", { body: { requestId: selected.id } });
    setSaving(false);
    if (error || !data?.ok) {
      setMessageType("error");
      setMessage(error?.message || data?.error || "Invoice email failed. It was not added to Waiting on Payment.");
      await loadRequests();
      return;
    }
    setMessageType(data.warning ? "error" : "success");
    setMessage(data.warning || "Invoice sent to the customer, Natalia was copied, and Waiting on Payment was updated.");
    await loadRequests();
  };

  return (
    <div className="appShell">
      <header className="hero">
        <div><p className="eyebrow">Accounting</p><h1>Invoice Requests</h1><p className="intro">Create invoices directly or complete jobs sent from the field.</p></div>
        <div className="actionRow"><button type="button" className="primaryButton" onClick={() => setShowNewInvoice((value) => !value)}>{showNewInvoice ? "Cancel New Invoice" : "New Invoice"}</button><button type="button" className="secondaryButton" onClick={onClose}>Back to dashboard</button></div>
      </header>

      {message ? <div className={messageType === "error" ? "errorBanner" : "successBanner"}>{message}</div> : null}
      {showNewInvoice ? <section className="panel">
        <h2>Start a new invoice</h2>
        <p>Create an invoice even when a job has not been sent through the completed-job queue.</p>
        <div className="formGrid">
          <label className="field"><span>Invoice number</span><input value={manualDraft.invoiceNumber} onChange={(event) => updateManualDraft("invoiceNumber", event.target.value)} /></label>
          <label className="field"><span>Invoice type</span><select value={manualDraft.invoiceType} onChange={(event) => updateManualDraft("invoiceType", event.target.value)}><option>Final</option><option>Progress</option></select></label>
          <label className="field"><span>Job number</span><input value={manualDraft.jobNumber} onChange={(event) => updateManualDraft("jobNumber", event.target.value)} /></label>
          <label className="field"><span>Project / property name</span><input value={manualDraft.projectName} onChange={(event) => updateManualDraft("projectName", event.target.value)} /></label>
          <label className="field"><span>Customer name *</span><input value={manualDraft.customerName} onChange={(event) => updateManualDraft("customerName", event.target.value)} /></label>
          <label className="field"><span>Billing contact *</span><input value={manualDraft.billingContactName} onChange={(event) => updateManualDraft("billingContactName", event.target.value)} /></label>
          <label className="field"><span>Billing email *</span><input type="email" value={manualDraft.billingEmail} onChange={(event) => updateManualDraft("billingEmail", event.target.value)} /></label>
          <label className="field"><span>Billing address *</span><input value={manualDraft.billingAddress} onChange={(event) => updateManualDraft("billingAddress", event.target.value)} /></label>
          <label className="field"><span>PO / customer reference</span><input value={manualDraft.purchaseOrderNumber} onChange={(event) => updateManualDraft("purchaseOrderNumber", event.target.value)} /></label>
          <label className="field"><span>Due date *</span><input type="date" value={manualDraft.dueDate} onChange={(event) => updateManualDraft("dueDate", event.target.value)} /></label>
          <label className="field"><span>Payment terms</span><input value={manualDraft.paymentTerms} onChange={(event) => updateManualDraft("paymentTerms", event.target.value)} /></label>
          <label className="field fieldFull"><span>Notes</span><textarea value={manualDraft.notes} onChange={(event) => updateManualDraft("notes", event.target.value)} /></label>
        </div>
        <InvoiceLineItems items={manualDraft.lineItems} onChange={(lineItems) => updateManualDraft("lineItems", lineItems)} />
        <button type="button" className="primaryButton" disabled={saving} onClick={createManualInvoice}>{saving ? "Creating…" : "Create Invoice"}</button>
      </section> : null}
      <section className="panel">
        <div className="formGrid">
          <label className="field"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Job, customer, or invoice" /></label>
          <label className="field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="open">Open requests</option><option value="all">All requests</option>{INVOICE_REQUEST_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        </div>
        <div className="detailList" style={{ marginTop: 14 }}><div><span>Open requests</span><strong>{requests.filter((request) => !["Paid", "Void"].includes(request.status)).length}</strong></div><div><span>Ready to send</span><strong>{requests.filter((request) => request.status === "Ready to Send").length}</strong></div></div>
      </section>

      <div className="fieldOpsReviewColumns">
        <section className="panel">
          <h2>Invoice queue</h2>
          {loading ? <p>Loading invoice requests…</p> : visibleRequests.length ? <div className="savedList">{visibleRequests.map((request) => (
            <button type="button" className={`savedCard ${selectedId === request.id ? "selected" : ""}`} key={request.id} onClick={() => setSelectedId(request.id)}>
              <div><span className="statusTag">{request.status}</span><strong>{request.job_number || request.project_name || request.invoice_number || "Invoice"}</strong><p>{request.customer_name} · {money(request.amount_to_invoice)}</p><small>{request.source_kind === "manual" ? "Created" : "Submitted"} {new Date(request.submitted_at).toLocaleString()}</small></div>
            </button>
          ))}</div> : <div className="emptyState"><p>No invoice requests match the filters.</p><button type="button" className="primaryButton" onClick={() => setShowNewInvoice(true)}>Start New Invoice</button></div>}
        </section>

        <section className="panel">
          <h2>Invoice workspace</h2>
          {!selected ? <div className="emptyState"><p>Select an invoice request or start a new invoice.</p><button type="button" className="primaryButton" onClick={() => setShowNewInvoice(true)}>New Invoice</button></div> : <>
            <div className="detailList">
              <div><span>Job</span><strong>{selected.job_number || selected.project_name || "Direct invoice"}</strong></div>
              <div><span>Customer</span><strong>{selected.customer_name}</strong></div>
              <div><span>Billing contact</span><strong>{selected.billing_contact_name}</strong><small>{selected.billing_email}</small></div>
              <div><span>Billing address</span><strong>{selected.billing_address}</strong></div>
              <div><span>PO / customer reference</span><strong>{selected.purchase_order_number || "Not provided"}</strong></div>
              <div><span>Completion date</span><strong>{selected.completion_date}</strong></div>
              <div><span>Invoice type</span><strong>{selected.invoice_type}</strong></div>
              <div><span>Contract amount</span><strong>{money(selected.contract_amount)}</strong></div>
              <div><span>Approved change orders</span><strong>{money(selected.change_orders_amount)}</strong></div>
              <div><span>Previously billed</span><strong>{money(selected.amount_already_billed)}</strong></div>
              <div><span>Retainage</span><strong>{money(selected.retainage_amount)}</strong></div>
              <div><span>Invoice total</span><strong>{money(lineTotal(draft.lineItems) || selected.amount_to_invoice)}</strong></div>
              <div><span>Handoff notes</span><strong>{selected.notes || "No handoff notes"}</strong></div>
            </div>
            <div className="formGrid" style={{ marginTop: 16 }}>
              <label className="field"><span>Status</span><select value={draft.status} disabled={["Sent", "Partially Paid", "Paid"].includes(selected.status)} onChange={(event) => updateDraft("status", event.target.value)}>{editableStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label className="field"><span>Invoice number</span><input value={draft.invoiceNumber} onChange={(event) => updateDraft("invoiceNumber", event.target.value)} /></label>
              <label className="field"><span>Due date</span><input type="date" value={draft.dueDate} onChange={(event) => updateDraft("dueDate", event.target.value)} /></label>
              <label className="field"><span>Payment terms</span><input value={draft.paymentTerms} onChange={(event) => updateDraft("paymentTerms", event.target.value)} /></label>
              <label className="field"><span>Missing information</span><textarea value={draft.missingInformationNotes} onChange={(event) => updateDraft("missingInformationNotes", event.target.value)} /></label>
              <label className="field fieldFull"><span>Accounting notes</span><textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
            </div>
            <InvoiceLineItems items={draft.lineItems} onChange={(lineItems) => updateDraft("lineItems", lineItems)} disabled={["Sent", "Partially Paid", "Paid"].includes(selected.status)} />
            <div className="panel" style={{ marginTop: 14 }}>
              <h3>Customer invoice PDF</h3>
              <p>{draft.invoiceFileName || "No invoice PDF generated or uploaded."}</p>
              <button type="button" className="secondaryButton" disabled={saving} onClick={generateInvoicePdf}>Generate Invoice PDF</button>
              <FileDropZone accept="application/pdf,.pdf" label="Upload Existing PDF" help="PDF only — up to 15 MB" multiple={false} onFiles={uploadInvoice} disabled={saving} />
            </div>
            <div className="panel" style={{ marginTop: 14 }}>
              <h3>Supporting documents</h3>
              <p>Attach signed proposals, photos, Word files, or other internal backup. These files are retained with the invoice and are not automatically emailed to the customer.</p>
              <FileDropZone accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,image/heic,image/heif" label="Choose Supporting Files" help="Drag, paste, or choose multiple files — up to 25 MB each" onFiles={uploadSupportDocuments} disabled={saving} />
              {supportDocuments.length ? <div className="savedList" style={{ marginTop: 12 }}>{supportDocuments.map((document) => <div className="savedCard" key={document.id}><div><strong>{document.file_name}</strong><small>{new Date(document.created_at).toLocaleString()}</small></div><button type="button" className="secondaryButton" onClick={() => openSupportDocument(document)}>Open</button></div>)}</div> : <p className="emptyState">No supporting documents attached.</p>}
            </div>
            <div className="actionRow" style={{ marginTop: 14 }}>
              <button type="button" className="secondaryButton" disabled={saving || selected.status === "Sent"} onClick={() => saveRequest()}>{saving ? "Saving…" : "Save Invoice"}</button>
              <button type="button" className="primaryButton" disabled={saving || selected.status === "Sent"} onClick={sendInvoice}>Send Invoice to Customer</button>
            </div>
            <h3 style={{ marginTop: 22 }}>Audit history</h3>
            {auditLog.length ? <div className="savedList">{auditLog.map((entry) => <div className="savedCard" key={entry.id}><div><strong>{String(entry.action).replaceAll("_", " ")}</strong><p>{entry.notes || "No additional notes"}</p><small>{new Date(entry.created_at).toLocaleString()}</small></div></div>)}</div> : <p className="emptyState">No audit events yet.</p>}
          </>}
        </section>
      </div>
    </div>
  );
}
