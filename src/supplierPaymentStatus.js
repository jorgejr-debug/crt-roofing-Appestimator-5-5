function amountValue(value) {
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function normalizeSupplierPaymentStatus(value, fallback = "Waiting on Payment") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "paid") return "Paid";
  if (["overdue", "past due", "past-due"].includes(normalized)) return "Overdue";
  if (["current", "waiting", "waiting on payment", "unpaid", "open"].includes(normalized)) return "Waiting on Payment";
  return fallback;
}

export function getSupplierPaymentStatus(entry = {}) {
  const fallback = entry.sourceCardKey === "supplierOverdue" ? "Overdue" : "Waiting on Payment";
  return normalizeSupplierPaymentStatus(entry.status || entry.paymentStatus, fallback);
}

export function filterSupplierPayablesByPaymentView(entries = [], view = "all") {
  const source = Array.isArray(entries) ? entries : [];
  const normalizedView = String(view || "all").trim().toLowerCase();
  if (normalizedView === "all") {
    return source.filter((entry) => getSupplierPaymentStatus(entry) !== "Paid");
  }
  return source.filter(
    (entry) => getSupplierPaymentStatus(entry).toLowerCase().replaceAll(" ", "-") === normalizedView,
  );
}

export function calculateSupplierPaymentApplication(balance, paymentKind = "Full", requestedAmount = 0) {
  const balanceBefore = amountValue(balance);
  const isFull = String(paymentKind || "").trim().toLowerCase() === "full";
  const amountPaid = isFull ? balanceBefore : Math.min(balanceBefore, amountValue(requestedAmount));
  const balanceAfter = Math.max(0, balanceBefore - amountPaid);
  return {
    balanceBefore,
    amountPaid,
    balanceAfter,
    paidInFull: balanceBefore > 0 && balanceAfter === 0,
  };
}

export function calculateSupplierPaymentTotals(entries = []) {
  return (Array.isArray(entries) ? entries : []).reduce(
    (totals, entry) => {
      const amount = amountValue(entry.amount);
      const status = getSupplierPaymentStatus(entry);
      if (status === "Paid") {
        totals.amountPaid += amount;
      } else {
        totals.totalPayable += amount;
        if (status === "Overdue") totals.overdue += amount;
        else totals.waitingOnPayment += amount;
      }
      return totals;
    },
    { totalPayable: 0, waitingOnPayment: 0, overdue: 0, amountPaid: 0 },
  );
}
