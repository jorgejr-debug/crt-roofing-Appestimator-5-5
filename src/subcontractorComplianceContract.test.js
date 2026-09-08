import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20260902100000_subcontractor_compliance.sql", import.meta.url), "utf8");
const documentsMigration = readFileSync(new URL("../supabase/migrations/20260908160000_subcontractor_documents.sql", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/send-subcontractor-compliance-email/index.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("./SubcontractorCompliance.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("subcontractor directory is protected and stores private COI metadata", () => {
  assert.match(migration, /ALTER TABLE public\.subcontractors ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /can_manage_subcontractor_compliance/);
  assert.match(migration, /subcontractors_read_active_directory/);
  assert.match(migration, /'admin','cfo','estimator','salesperson'/);
  assert.match(migration, /natalia@crtroofing\.com/);
  assert.match(migration, /'subcontractor-coi','subcontractor-coi',false/);
  assert.match(ui, /COI names CRT Roofing/);
  assert.match(ui, /Pricing &amp; Information Contact/);
  assert.match(ui, /mailto:/);
  assert.match(ui, /tel:/);
  assert.match(app, /label: "Subcontractors"/);
  assert.match(app, /readOnly={!canManageSubcontractorCompliance}/);
  assert.match(app, /<strong>Approved Vendors<\/strong>/);
  assert.match(app, /onClick=\{\(\) => setActiveTemplate\("subcontractors"\)\}/);
  assert.match(ui, /Approved \/ active\?/);
  assert.match(ui, /Approved Vendors &amp; Subcontractors/);
});

test("multiple subcontractor documents remain private and manager-only", () => {
  assert.match(documentsMigration, /CREATE TABLE public\.subcontractor_documents/);
  assert.match(documentsMigration, /ALTER TABLE public\.subcontractor_documents ENABLE ROW LEVEL SECURITY/);
  assert.match(documentsMigration, /can_manage_subcontractor_compliance\(\)/);
  assert.doesNotMatch(documentsMigration, /TO anon/);
});

test("expiration notifications are staged, deduplicated, scheduled, and emailed to Natalia", () => {
  for (const window of ["30_day","14_day","7_day","expired"]) assert.match(migration, new RegExp(window));
  assert.match(migration, /UNIQUE\(subcontractor_id,expiration_date,notification_window\)/);
  assert.match(migration, /cron\.schedule\('subcontractor-compliance-daily'/);
  assert.match(edge, /natalia@crtroofing\.com/);
  assert.match(edge, /RESEND_API_KEY/);
  assert.match(edge, /TASK_NOTIFICATION_WEBHOOK_SECRET/);
});
