import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateReceivablePaymentTotals,
  filterReceivablesByPaymentView,
  getReceivablePaymentStatus,
  normalizeReceivablePaymentStatus,
} from "./receivablePaymentStatus.js";

test("legacy Current status becomes Waiting on Payment", () => {
  assert.equal(normalizeReceivablePaymentStatus("Current"), "Waiting on Payment");
});

test("the default receivable view archives paid records into paid history", () => {
  const entries = [
    { id: "waiting", paymentStatus: "Waiting on Payment", periodToDate: "2026-09-30" },
    { id: "overdue", paymentStatus: "Overdue" },
    { id: "paid", paymentStatus: "Paid" },
  ];

  assert.deepEqual(filterReceivablesByPaymentView(entries, "all", "2026-09-04").map((entry) => entry.id), ["waiting", "overdue"]);
  assert.deepEqual(filterReceivablesByPaymentView(entries, "paid", "2026-09-04").map((entry) => entry.id), ["paid"]);
});

test("paid balances are historical and excluded from outstanding totals", () => {
  const totals = calculateReceivablePaymentTotals(
    [
      { amountOwed: "$1,000", paymentStatus: "Waiting on Payment", periodToDate: "2026-09-01" },
      { amountOwed: "500", paymentStatus: "Overdue" },
      { amountOwed: "250", paymentStatus: "Paid", periodToDate: "2026-01-01" },
    ],
    "2026-08-27",
  );
  assert.deepEqual(totals, { accountsReceivable: 1500, pastDue: 500, amountPaid: 250, unpaidCount: 2 });
});

test("a waiting balance becomes overdue after its due date but a paid balance stays paid", () => {
  assert.equal(getReceivablePaymentStatus({ paymentStatus: "Waiting on Payment", periodToDate: "2026-08-01" }, "2026-08-27"), "Overdue");
  assert.equal(getReceivablePaymentStatus({ paymentStatus: "Paid", periodToDate: "2026-08-01" }, "2026-08-27"), "Paid");
});
