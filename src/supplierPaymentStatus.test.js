import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSupplierPaymentTotals,
  calculateSupplierPaymentApplication,
  filterSupplierPayablesByPaymentView,
  getSupplierPaymentStatus,
  normalizeSupplierPaymentStatus,
} from "./supplierPaymentStatus.js";

test("legacy supplier statuses normalize into the consolidated workflow", () => {
  assert.equal(normalizeSupplierPaymentStatus("Current"), "Waiting on Payment");
  assert.equal(normalizeSupplierPaymentStatus("Past Due"), "Overdue");
  assert.equal(normalizeSupplierPaymentStatus("Paid"), "Paid");
  assert.equal(getSupplierPaymentStatus({ sourceCardKey: "supplierOverdue" }), "Overdue");
});

test("full and partial supplier payments calculate the remaining payable", () => {
  assert.deepEqual(calculateSupplierPaymentApplication(1000, "Partial", 250), {
    balanceBefore: 1000,
    amountPaid: 250,
    balanceAfter: 750,
    paidInFull: false,
  });
  assert.deepEqual(calculateSupplierPaymentApplication(1000, "Full", 1), {
    balanceBefore: 1000,
    amountPaid: 1000,
    balanceAfter: 0,
    paidInFull: true,
  });
});

test("paid supplier invoices remain historical and leave outstanding totals", () => {
  assert.deepEqual(calculateSupplierPaymentTotals([
    { amount: "$1,000", status: "Waiting on Payment" },
    { amount: "500", status: "Overdue" },
    { amount: "250", status: "Paid" },
  ]), {
    totalPayable: 1500,
    waitingOnPayment: 1000,
    overdue: 500,
    amountPaid: 250,
  });
});

test("the normal supplier view hides paid invoices while Paid history preserves them", () => {
  const entries = [
    { id: "waiting", status: "Waiting on Payment" },
    { id: "overdue", status: "Overdue" },
    { id: "paid", status: "Paid" },
  ];

  assert.deepEqual(filterSupplierPayablesByPaymentView(entries, "all").map((entry) => entry.id), ["waiting", "overdue"]);
  assert.deepEqual(filterSupplierPayablesByPaymentView(entries, "paid").map((entry) => entry.id), ["paid"]);
});
