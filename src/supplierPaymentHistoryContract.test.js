import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const migrationSource = fs.readFileSync(
  new URL("../supabase/migrations/20260904150000_supplier_payment_history.sql", import.meta.url),
  "utf8",
);

test("supplier payable rows provide a green server-backed paid action", () => {
  assert.match(appSource, /className="successButton"[\s\S]*?openSupplierPaymentDialog\(entry\)/);
  assert.match(appSource, /rpc\("record_supplier_payment"/);
  assert.match(appSource, /logged in Administration/);
  assert.match(appSource, /Supplier Payment History/);
});

test("supplier payment recording is finance-only and creates immutable history rows", () => {
  assert.match(migrationSource, /caller_role NOT IN \('admin', 'cfo'\)/);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.supplier_payment_history/);
  assert.match(migrationSource, /recorded_at timestamptz NOT NULL DEFAULT clock_timestamp\(\)/);
  assert.match(migrationSource, /recorded_by uuid NOT NULL REFERENCES public\.user_profiles/);
  assert.match(migrationSource, /card_key IN \('supplierTotalsPayable', 'supplierOverdue'\)/);
  assert.match(migrationSource, /REVOKE ALL ON TABLE public\.supplier_payment_history/);
  assert.match(migrationSource, /GRANT SELECT ON TABLE public\.supplier_payment_history TO authenticated/);
});

test("payment dialog supports check references and partial payment balances", () => {
  assert.match(appSource, /When was it paid\?/);
  assert.match(appSource, /How was it paid\?/);
  assert.match(appSource, /Check number/);
  assert.match(appSource, /Partially paid/);
  assert.match(appSource, /Partial payment amount/);
  assert.match(migrationSource, /payment_kind IN \('Full', 'Partial'\)/);
  assert.match(migrationSource, /balance_after := balance_before - applied_amount/);
  assert.match(migrationSource, /status = CASE WHEN balance_after = 0 THEN 'Paid' ELSE status END/);
});
