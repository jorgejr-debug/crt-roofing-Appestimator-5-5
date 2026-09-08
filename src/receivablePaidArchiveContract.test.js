import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("CFO receivable rows provide a confirmed green paid action", () => {
  assert.match(source, /className="successButton"[\s\S]*?>\s*Mark Paid/);
  assert.match(source, /Mark \$\{customerName\} as paid and move this payment to Paid history\?/);
  assert.match(source, /paymentStatus: "Paid"/);
});

test("paid receivables move out of the default view but remain in paid history", () => {
  assert.match(source, /filterReceivablesByPaymentView\(receivableEntries, cfoDashboardFilters\.currentOverdue\)/);
  assert.match(source, /"Outstanding only"/);
  assert.match(source, /"Paid history"/);
  assert.match(source, /was marked paid and moved to Paid history/);
});
