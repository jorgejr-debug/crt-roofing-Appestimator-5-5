export const INVOICE_REQUEST_STATUSES = [
  "Ready for Invoice",
  "In Review",
  "Missing Information",
  "Ready to Send",
  "Sending",
  "Sent",
  "Send Failed",
  "Partially Paid",
  "Paid",
  "Void",
];

const safeText = (value) => String(value || "").trim();
const safeAmount = (value) => {
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export function canManageInvoiceQueue(role, email = "") {
  const normalizedRole = safeText(role).toLowerCase();
  const normalizedEmail = safeText(email).toLowerCase();
  return normalizedRole === "admin"
    || normalizedRole === "cfo"
    || normalizedEmail === "natalia@crtroofing.com";
}

export function canSubmitJobForInvoice(role) {
  const normalizedRole = safeText(role).toLowerCase();
  return normalizedRole === "admin" || normalizedRole === "cfo";
}

export function createInvoiceHandoffDraft(job = {}, today = new Date().toISOString().slice(0, 10)) {
  const contractAmount = safeAmount(job.contractAmount ?? job.finalBid ?? job.approvedBidAmount);
  const changeOrders = safeAmount(job.changeOrders ?? job.changeOrdersTotal);
  const amountAlreadyBilled = safeAmount(job.amountBilled);
  const totalSalePrice = contractAmount + changeOrders;

  return {
    completionDate: today,
    invoiceType: "Final",
    customerName: safeText(job.customerName || job.customer || job.propertyOwner),
    billingContactName: safeText(job.billingContactName || job.projectContact),
    billingEmail: safeText(job.billingEmail || job.customerEmail || job.projectContactEmail),
    billingAddress: safeText(job.billingAddress || job.projectAddress || job.jobAddress || job.address),
    purchaseOrderNumber: safeText(job.purchaseOrderNumber || job.poNumber),
    paymentTerms: safeText(job.paymentTerms) || "Due on receipt",
    contractAmount,
    changeOrders,
    amountAlreadyBilled,
    amountToInvoice: Math.max(0, totalSalePrice - amountAlreadyBilled),
    retainageAmount: 0,
    notes: "",
  };
}

export function validateInvoiceHandoffDraft(draft = {}) {
  const errors = [];
  if (!safeText(draft.completionDate)) errors.push("Completion date is required.");
  if (!safeText(draft.customerName)) errors.push("Customer name is required.");
  if (!safeText(draft.billingContactName)) errors.push("Billing contact is required.");
  if (!/^\S+@\S+\.\S+$/.test(safeText(draft.billingEmail))) errors.push("A valid billing email is required.");
  if (!safeText(draft.billingAddress)) errors.push("Billing address is required.");
  if (safeAmount(draft.amountToInvoice) <= 0) errors.push("Amount to invoice must be greater than zero.");
  if (safeAmount(draft.retainageAmount) > safeAmount(draft.amountToInvoice)) errors.push("Retainage cannot exceed the invoice amount.");
  return errors;
}

export function invoiceReceivableSourceId(invoiceRequestId) {
  return `receivable:waitingOnPayment:invoice-${safeText(invoiceRequestId)}`;
}

