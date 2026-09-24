import test from "node:test";
import assert from "node:assert/strict";
import {
  SALES_APPROVAL_ACKNOWLEDGEMENT,
  addBusinessDays,
  buildProductionGateReasons,
  calculateDefaultTargetAt,
  calculateProposalMetrics,
  getSlaDisplay,
  validateProposalRequest,
} from "./proposalRequestWorkflow.js";

const completeRequest = {
  customer_name: "Customer", property_name: "Building A", service_address: "100 Main St", billing_information: "AP contact",
  project_contact_first_name: "Jane", project_contact_last_name: "Doe", project_contact_phone: "909-555-0100",
  project_contact_email: "jane@example.com", salesperson_id: "sales-id", scope_of_work: "Reroof", roof_areas: "Area A", roofing_system: "TPO",
  work_type: "tear-off", measurements: "100 SQ", roof_measurement_notes: "Field measured", property_type: "commercial",
  story_count: "1", construction_type: "existing roof", material_specifications: "60 mil TPO", estimated_crew_size: 6,
  estimated_working_days: 4, estimated_material_quantities: "100 SQ", estimated_labor_assumptions: "6 people / 4 days", customer_deadline: "2026-09-10",
  job_type: "standard_roof",
};

test("incomplete requests cannot enter the estimating queue", () => {
  const result = validateProposalRequest({ ...completeRequest, scope_of_work: "", measurements: "" });
  assert.equal(result.valid, false);
  assert.deepEqual(result.missing, ["Detailed scope of work", "Measurements / square footage / squares"]);
});

test("Daniela's core estimating intake questions are required", () => {
  const result = validateProposalRequest({ ...completeRequest, project_contact_phone: "", roof_measurement_notes: "", property_type: "" });
  assert.deepEqual(result.missing, ["Project contact phone number", "Roof measurement notes", "Property type"]);
});

test("large RFP requires a manual ETA", () => {
  assert.equal(validateProposalRequest({ ...completeRequest, job_type: "large_rfp" }).valid, false);
  assert.equal(validateProposalRequest({ ...completeRequest, job_type: "large_rfp", manual_target_at: "2026-09-15T17:00:00Z" }).valid, true);
});

test("business-day SLA skips weekends", () => {
  const friday = new Date("2026-08-28T17:00:00Z");
  assert.equal(addBusinessDays(friday, 1).toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(calculateDefaultTargetAt(friday, "complex_commercial"), "2026-09-01T17:00:00.000Z");
});

test("missing information pauses SLA display", () => {
  assert.deepEqual(getSlaDisplay({ target_completion_at: "2026-08-01T00:00:00Z", sla_paused_at: "2026-07-31T00:00:00Z" }, new Date("2026-08-02T00:00:00Z")), {
    tone: "missing", label: "SLA paused — missing information",
  });
});

test("production remains blocked without signed authorized scope", () => {
  const reasons = buildProductionGateReasons({ deposit_required: true }, [], []);
  assert.ok(reasons.includes("Proposal not finalized"));
  assert.ok(reasons.includes("Salesperson scope approval missing"));
  assert.ok(reasons.includes("Customer signature missing"));
  assert.ok(reasons.includes("No proposal sections are approved"));
  assert.ok(reasons.includes("Required deposit not received"));
  assert.ok(reasons.includes("Production scope has not been generated"));
});

test("partially approved proposal releases only approved sections", () => {
  const versions = [{ finalized_at: "2026-08-30", sales_approved_at: "2026-08-30", sales_approved_by: "sales", customer_decision: "signed", customer_signed_at: "2026-08-30", signed_pdf_storage_path: "request/signed.pdf", sections: [
    { id: "a", customer_approved: true }, { id: "b", customer_approved: false },
  ] }];
  assert.deepEqual(buildProductionGateReasons({ production_scope_generated_at: "2026-08-30", deposit_required: false }, versions, []), []);
});

test("unsigned required change order blocks release", () => {
  const versions = [{ finalized_at: "x", sales_approved_at: "x", sales_approved_by: "sales", customer_decision: "signed", customer_signed_at: "x", signed_pdf_storage_path: "request/signed.pdf", sections: [{ id: "a", customer_approved: true }] }];
  const reasons = buildProductionGateReasons({ production_scope_generated_at: "x" }, versions, [{ required_for_release: true, status: "sent" }]);
  assert.deepEqual(reasons, ["Required change order not signed"]);
});

test("sales acknowledgement is explicit and durable", () => {
  assert.match(SALES_APPROVAL_ACKNOWLEDGEMENT, /scope, measurements, production assumptions, exclusions, and pricing information/);
});

test("reporting includes conversion, overdue, incomplete, and unauthorized-start metrics", () => {
  const metrics = calculateProposalMetrics([
    { submitted_at: "2026-08-01T00:00:00Z", sent_at: "2026-08-01T12:00:00Z", status: "signed", signed_at: "2026-08-02", missing_information_count: 1 },
    { submitted_at: "2026-08-01T00:00:00Z", target_completion_at: "2026-08-02", status: "under_review", production_started_without_authorization: true },
  ]);
  assert.equal(metrics.submitted, 2); assert.equal(metrics.signed, 1); assert.equal(metrics.conversionRate, 50);
  assert.equal(metrics.missingInformation, 1); assert.equal(metrics.unauthorizedStarts, 1); assert.equal(metrics.overdue, 1);
});
