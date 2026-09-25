import { readAppSource } from "../tests/appSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readAppSource();

test("customer paid action waits for shared database confirmation", () => {
  const start = source.indexOf("const markReceivableEntryPaid = async (entry) =>");
  const end = source.indexOf("\n    const openSupplierPaymentDialog", start);
  const paidSource = source.slice(start, end);
  const saveIndex = paidSource.indexOf("await upsertCompanyFinancialRecordsToSupabase");
  const updateIndex = paidSource.indexOf("setCfoReceivableEntries(nextReceivableEntries)");
  const successIndex = paidSource.indexOf('setCfoReceivablePaymentMessageType("success")');

  assert.ok(saveIndex >= 0, "paid action should save directly to shared company data");
  assert.ok(updateIndex > saveIndex, "screen must not show paid before the database confirms it");
  assert.ok(successIndex > updateIndex, "green success must follow the confirmed state update");
  assert.match(paidSource, /Payment not recorded:/);
});

test("customer paid action locks duplicate clicks and distinguishes errors", () => {
  assert.match(source, /if \(!entry\?\.id \|\| cfoReceivablePaymentSavingId\) return;/);
  assert.match(source, /disabled=\{Boolean\(cfoReceivablePaymentSavingId\)\}/);
  assert.match(source, /Saving payment…/);
  assert.match(source, /cfoReceivablePaymentMessageType === "error" \? "dangerMessage" : "proposalSuccess"/);
});
