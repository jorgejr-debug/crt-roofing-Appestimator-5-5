import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INVOICE_REQUEST_STATUSES } from "./invoiceWorkflow.js";

const money = (value) => Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const safeFileName = (value) => String(value || "invoice.pdf").replace(/[^a-zA-Z0-9._-]+/g, "-");
const editableStatuses = INVOICE_REQUEST_STATUSES.filter((status) => !["Sending", "Sent", "Partially Paid", "Paid"].includes(status));

function createDraft(request = {}) {
  return {
    status: request.status || "Ready for Invoice",
    invoiceNumber: request.invoice_number || "",
    dueDate: request.due_date || "",
    paymentTerms: request.payment_terms || "Due on receipt",
    amountToInvoice: Number(request.amount_to_invoice || 0),
    missingInformationNotes: request.missing_information_notes || "",
    notes: request.notes || "",
    invoiceFileName: request.invoice_file_name || "",
    invoiceStoragePath: request.invoice_storage_path || "",
  };
}

export default function InvoiceQueue({ supabase, authUser, onClose }) {
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(createDraft());
  const [auditLog, setAuditLog] = useState([]);
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const fileInputRef = useRef(null);

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
        return;
      }
      const { data } = await supabase.from("invoice_request_audit_log").select("*").eq("invoice_request_id", selected.id).order("created_at", { ascending: false });
      if (!cancelled) setAuditLog(Array.isArray(data) ? data : []);
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
      p_amount_to_invoice: Number(draft.amountToInvoice || 0),
      p_missing_information_notes: draft.missingInformationNotes,
      p_notes: draft.notes,
      p_invoice_file_name: draft.invoiceFileName,
      p_invoice_storage_path: draft.invoiceStoragePath,
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

  const uploadInvoice = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
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
    setSaving(true);
    const path = `${selected.id}/${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await supabase.storage.from("invoice-documents").upload(path, file, { contentType: "application/pdf", upsert: false });
    setSaving(false);
    if (error) {
      setMessageType("error");
      setMessage(error.message || "Invoice PDF upload failed.");
      return;
    }
    updateDraft("invoiceFileName", file.name);
    updateDraft("invoiceStoragePath", path);
    setMessageType("success");
    setMessage("Invoice PDF uploaded. Save the invoice details before sending.");
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
        <div><p className="eyebrow">Accounting</p><h1>Invoice Requests</h1><p className="intro">Completed jobs waiting for Natalia to prepare and send an invoice.</p></div>
        <button type="button" className="secondaryButton" onClick={onClose}>Back to dashboard</button>
      </header>

      {message ? <div className={messageType === "error" ? "errorBanner" : "successBanner"}>{message}</div> : null}
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
              <div><span className="statusTag">{request.status}</span><strong>{request.job_number || request.project_name || "Job"}</strong><p>{request.customer_name} · {money(request.amount_to_invoice)}</p><small>Submitted {new Date(request.submitted_at).toLocaleString()}</small></div>
            </button>
          ))}</div> : <p className="emptyState">No invoice requests match the filters.</p>}
        </section>

        <section className="panel">
          <h2>Invoice workspace</h2>
          {!selected ? <p className="emptyState">Select an invoice request.</p> : <>
            <div className="detailList">
              <div><span>Job</span><strong>{selected.job_number || selected.project_name}</strong></div>
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
              <div><span>Requested amount</span><strong>{money(selected.amount_to_invoice)}</strong></div>
              <div><span>Handoff notes</span><strong>{selected.notes || "No handoff notes"}</strong></div>
            </div>
            <div className="formGrid" style={{ marginTop: 16 }}>
              <label className="field"><span>Status</span><select value={draft.status} disabled={["Sent", "Partially Paid", "Paid"].includes(selected.status)} onChange={(event) => updateDraft("status", event.target.value)}>{editableStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label className="field"><span>Invoice number</span><input value={draft.invoiceNumber} onChange={(event) => updateDraft("invoiceNumber", event.target.value)} /></label>
              <label className="field"><span>Due date</span><input type="date" value={draft.dueDate} onChange={(event) => updateDraft("dueDate", event.target.value)} /></label>
              <label className="field"><span>Payment terms</span><input value={draft.paymentTerms} onChange={(event) => updateDraft("paymentTerms", event.target.value)} /></label>
              <label className="field"><span>Amount to invoice</span><input type="number" min="0.01" step="0.01" value={draft.amountToInvoice} onChange={(event) => updateDraft("amountToInvoice", event.target.value)} /></label>
              <label className="field"><span>Missing information</span><textarea value={draft.missingInformationNotes} onChange={(event) => updateDraft("missingInformationNotes", event.target.value)} /></label>
              <label className="field fieldFull"><span>Accounting notes</span><textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
            </div>
            <div className="panel" style={{ marginTop: 14 }}><strong>Invoice PDF</strong><p>{draft.invoiceFileName || "No invoice PDF uploaded."}</p><input ref={fileInputRef} type="file" accept="application/pdf,.pdf" hidden onChange={uploadInvoice} /><button type="button" className="secondaryButton" disabled={saving} onClick={() => fileInputRef.current?.click()}>Upload Invoice PDF</button></div>
            <div className="actionRow" style={{ marginTop: 14 }}>
              <button type="button" className="secondaryButton" disabled={saving || selected.status === "Sent"} onClick={() => saveRequest()}>{saving ? "Saving…" : "Save"}</button>
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
