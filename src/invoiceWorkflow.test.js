import assert from "node:assert/strict";
import test from "node:test";
import {
  canManageInvoiceQueue,
  canSubmitJobForInvoice,
  createInvoiceHandoffDraft,
  invoiceReceivableSourceId,
  validateInvoiceHandoffDraft,
} from "./invoiceWorkflow.js";

test("invoice closing is limited to existing shared-job managers", () => {
  assert.equal(canSubmitJobForInvoice("admin"), true);
  assert.equal(canSubmitJobForInvoice("cfo"), true);
  assert.equal(canSubmitJobForInvoice("salesperson"), false);
});

test("Natalia can manage the invoice queue without finance access", () => {
  assert.equal(canManageInvoiceQueue("salesperson", "natalia@crtroofing.com"), true);
  assert.equal(canManageInvoiceQueue("salesperson", "daniela@crtroofing.com"), false);
});

test("handoff calculates contract, change orders, and prior billing", () => {
  assert.deepEqual(createInvoiceHandoffDraft({
      contractAmount: 50000,
      changeOrders: 2500,
      amountBilled: 10000,
      customerName: "CRT Customer",
    }, "2026-09-08"), {
      completionDate: "2026-09-08",
      invoiceType: "Final",
      customerName: "CRT Customer",
      billingContactName: "",
      billingEmail: "",
      billingAddress: "",
      purchaseOrderNumber: "",
      paymentTerms: "Due on receipt",
      contractAmount: 50000,
      changeOrders: 2500,
      amountAlreadyBilled: 10000,
      amountToInvoice: 42500,
      retainageAmount: 0,
      notes: "",
    });
});

test("incomplete handoffs are blocked", () => {
  assert.deepEqual(validateInvoiceHandoffDraft({}), [
      "Completion date is required.",
      "Customer name is required.",
      "Billing contact is required.",
      "A valid billing email is required.",
      "Billing address is required.",
      "Amount to invoice must be greater than zero.",
    ]);
});

test("receivable ids are stable to prevent duplicate waiting-on-payment entries", () => {
  assert.equal(invoiceReceivableSourceId("abc-123"), "receivable:waitingOnPayment:invoice-abc-123");
});
