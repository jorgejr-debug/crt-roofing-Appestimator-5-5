import assert from "node:assert/strict";
import test from "node:test";
import {
  applyInspectionExtractionToDraft,
  inspectionExtractionReadiness,
  normalizeInspectionExtraction,
} from "./inspectionHandoffExtraction.js";

test("inspection extraction ignores unsupported and duplicate fields", () => {
  const result = normalizeInspectionExtraction({ fields: [
    { key: "measurements", value: "42 squares", evidence: "about forty-two squares", confidence: "high" },
    { key: "measurements", value: "99 squares", evidence: "", confidence: "high" },
    { key: "made_up_field", value: "invented", evidence: "", confidence: "high" },
  ] });
  assert.equal(result.extracted.measurements, "42 squares");
  assert.equal(result.fields.length, 1);
  assert.ok(result.missing_critical.includes("Recommended scope"));
});

test("extraction fills the handoff while preserving a usable property name", () => {
  const result = applyInspectionExtractionToDraft({}, { fields: [
    { key: "customer_name", value: "Sample Customer", evidence: "sample customer", confidence: "high" },
    { key: "service_address", value: "100 Main St", evidence: "100 Main", confidence: "high" },
    { key: "scope_of_work", value: "Replace wet insulation and install TPO", evidence: "replace wet insulation", confidence: "medium" },
    { key: "measurements", value: "42 squares", evidence: "42 squares", confidence: "high" },
  ] });
  assert.equal(result.draft.property_name, "Sample Customer");
  assert.equal(inspectionExtractionReadiness(result.draft, result.extraction).ready, true);
  assert.ok(result.extraction.needs_confirmation.includes("Recommended scope"));
});
