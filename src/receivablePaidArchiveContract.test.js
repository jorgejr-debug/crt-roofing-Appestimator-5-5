import { readAppSource } from "../tests/appSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readAppSource();

test("CFO receivable rows provide a confirmed green paid action", () => {
  assert.match(source, /className="successButton"[\s\S]*Saving payment…[\s\S]*Mark Paid/);
  assert.match(source, /Mark \$\{customerName\} as paid and move this payment to Paid history\?/);
  assert.match(source, /paymentStatus: "Paid"/);
});

test("paid receivables move out of the default view but remain in paid history", () => {
  assert.match(source, /filterReceivablesByPaymentView\(receivableEntries, cfoDashboardFilters\.currentOverdue\)/);
  assert.match(source, /"Outstanding only"/);
  assert.match(source, /"Paid history"/);
  assert.match(source, /was marked paid and moved to Paid history/);
});
