import { readAppSource } from "../tests/appSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readAppSource();
const migration = readFileSync(new URL("../supabase/migrations/20260922113000_crm_lead_work_orders.sql", import.meta.url), "utf8");

test("Quick Lead Capture accepts an optional PDF work order", () => {
  assert.match(app, /PDF work order \(optional\)/);
  assert.match(app, /accept="\.pdf,application\/pdf"/);
  assert.match(app, /CRM_LEAD_WORK_ORDER_MAX_BYTES = 25 \* 1024 \* 1024/);
  assert.match(app, /uploadCrmLeadWorkOrder/);
  assert.match(app, /Work orders must be PDF files/);
});

test("lead work orders are private and scoped to their CRM lead", () => {
  assert.match(migration, /'crm-lead-files','crm-lead-files',false/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.crm_lead_documents/);
  assert.match(migration, /ALTER TABLE public\.crm_lead_documents ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /p_storage_path NOT LIKE p_lead_id::text\|\|'\/%'/);
  assert.match(migration, /file_size_limit=EXCLUDED\.file_size_limit/);
});

test("Ivan's inspection task identifies an attached CRM work order", () => {
  assert.match(app, /PDF work order attached in CRM/);
  assert.match(app, /crmLeadDocuments/);
  assert.match(app, /Open PDF:/);
  assert.match(app, /createSignedUrl\(document\.storage_path, 300\)/);
});
