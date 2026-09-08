function safeAmount(value) {
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function normalizeReceivablePaymentStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "paid") return "Paid";
  if (normalized === "overdue") return "Overdue";
  return "Waiting on Payment";
}

export function getReceivablePaymentStatus(entry = {}, today = new Date().toISOString().slice(0, 10)) {
  const explicitStatus = normalizeReceivablePaymentStatus(entry.paymentStatus || entry.payment_status);
  if (explicitStatus === "Paid" || explicitStatus === "Overdue") return explicitStatus;
  const dueDate = String(entry.periodToDate || entry.period_to_date || "").trim();
  return dueDate && dueDate < today ? "Overdue" : "Waiting on Payment";
}

export function calculateReceivablePaymentTotals(entries = [], today) {
  return (Array.isArray(entries) ? entries : []).reduce(
    (totals, entry) => {
      const amount = safeAmount(entry.amountOwed ?? entry.amount_owed);
      const status = getReceivablePaymentStatus(entry, today);
      if (status === "Paid") {
        totals.amountPaid += amount;
      } else {
        totals.accountsReceivable += amount;
        totals.unpaidCount += 1;
        if (status === "Overdue") totals.pastDue += amount;
      }
      return totals;
    },
    { accountsReceivable: 0, pastDue: 0, amountPaid: 0, unpaidCount: 0 },
  );
}

export function filterReceivablesByPaymentView(entries = [], view = "all", today) {
  const normalizedView = String(view || "all").trim().toLowerCase();
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const status = getReceivablePaymentStatus(entry, today);
    if (normalizedView === "paid") return status === "Paid";
    if (normalizedView === "overdue") return status === "Overdue";
    if (normalizedView === "waiting-on-payment") return status === "Waiting on Payment";
    return status !== "Paid";
  });
}
