import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("supplier payables combine legacy current and overdue records in one view", () => {
  assert.match(source, /getManualCardEntries\("supplierTotalsPayable"\)[\s\S]*?getManualCardEntries\("supplierOverdue"\)/);
  assert.doesNotMatch(source, /cfoSupplierPayablesView/);
  assert.match(source, /visibleSupplierPayableEntries\.map/);
});

test("supplier invoices remain outstanding until a recorded payment and show paid totals", () => {
  assert.match(source, /Use the green payment button below to record payments/);
  assert.match(source, /<option value="Waiting on Payment">Waiting on Payment<\/option>[\s\S]*?<option value="Overdue">Overdue<\/option>/);
  assert.match(source, /label: "Amount paid", value: money\(supplierAmountPaidTotal\)/);
  assert.match(source, /primaryValue: money\(supplierPaymentTotals\.totalPayable\)/);
});
