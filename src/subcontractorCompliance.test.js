import test from "node:test";
import assert from "node:assert/strict";
import { daysUntilDate, getSubcontractorComplianceStatus, normalizeSubcontractorPayload, validateSubcontractor } from "./subcontractorCompliance.js";

const now = new Date("2026-09-02T12:00:00");

test("subcontractor compliance flags expiration stages and missing COI", () => {
  const base = { is_active: true, license_status: "licensed", license_number: "C-123", workers_comp_active: true, workers_comp_expiration_date: "2026-09-22", coi_names_crt_insured: true, coi_storage_path: "file.pdf" };
  assert.equal(daysUntilDate("2026-09-22", now), 20);
  assert.equal(getSubcontractorComplianceStatus(base, now).key, "expiring");
  assert.equal(getSubcontractorComplianceStatus({ ...base, coi_names_crt_insured: false }, now).key, "missing_coi");
  assert.equal(getSubcontractorComplianceStatus({ ...base, workers_comp_expiration_date: "2026-09-01" }, now).key, "expired");
});

test("licensed subcontractors require a license and active workers comp requires expiration", () => {
  const result = validateSubcontractor({ company_name: "ABC", trade: "HVAC", contact_name: "Pat", license_status: "licensed", workers_comp_active: true });
  assert.equal(result.valid, false);
  assert.ok(result.missing.includes("License number"));
  assert.ok(result.missing.includes("Workers' compensation expiration date"));
});

test("optional subcontractor dates are stored as null instead of invalid empty strings", () => {
  const inactive = normalizeSubcontractorPayload({ license_expiration_date: "", workers_comp_active: false, workers_comp_expiration_date: "" });
  assert.equal(inactive.license_expiration_date, null);
  assert.equal(inactive.workers_comp_expiration_date, null);

  const active = normalizeSubcontractorPayload({ workers_comp_active: true, workers_comp_expiration_date: "2027-01-15" });
  assert.equal(active.workers_comp_expiration_date, "2027-01-15");
});
