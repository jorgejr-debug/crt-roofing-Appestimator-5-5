export const INSPECTION_HANDOFF_FIELD_LABELS = {
  customer_name: "Customer / job name",
  property_name: "Property / job name",
  service_address: "Service address",
  project_contact_first_name: "Contact first name",
  project_contact_last_name: "Contact last name",
  project_contact_phone: "Contact phone",
  project_contact_email: "Contact email",
  customer_requests: "Customer request",
  property_type: "Property type",
  story_count: "Building height",
  construction_type: "Existing roof or new construction",
  roofing_system: "Existing roofing system",
  roof_areas: "Roof areas / sections",
  work_type: "Work type",
  measurements: "Measurements / square footage / squares",
  roof_measurement_notes: "Roof measurement notes",
  existing_layers: "Existing layers",
  scope_of_work: "Recommended scope",
  material_specifications: "Material / system specifications",
  special_conditions: "Risks or special conditions",
  roof_access_details: "Roof and property access",
  equipment_requirements: "Equipment requirements",
  hvac_requirements: "HVAC requirements",
  subcontractor_requirements: "Subcontractors",
  permit_requirements: "Permit requirements",
  overspray_risk_notes: "Overspray risk",
  exclusions: "Exclusions",
  alternates: "Alternates / optional work",
  verbal_commitments: "Anything discussed or promised",
  customer_deadline: "Customer deadline",
  estimated_crew_size: "Estimated crew size",
  estimated_working_days: "Estimated working days",
};

export const INSPECTION_HANDOFF_FIELD_KEYS = Object.keys(INSPECTION_HANDOFF_FIELD_LABELS);

export const CRITICAL_INSPECTION_HANDOFF_FIELDS = [
  "customer_name",
  "service_address",
  "scope_of_work",
  "measurements",
];

const text = (value) => String(value ?? "").trim();

export function normalizeInspectionExtraction(payload = {}) {
  const rows = Array.isArray(payload.fields) ? payload.fields : [];
  const seen = new Set();
  const fields = rows.flatMap((row) => {
    const key = text(row?.key);
    const value = text(row?.value);
    if (!INSPECTION_HANDOFF_FIELD_KEYS.includes(key) || !value || seen.has(key)) return [];
    seen.add(key);
    const confidence = ["high", "medium", "low"].includes(row?.confidence) ? row.confidence : "low";
    return [{ key, value, evidence: text(row?.evidence), confidence }];
  });
  const extracted = Object.fromEntries(fields.map((row) => [row.key, row.value]));
  const missingCritical = CRITICAL_INSPECTION_HANDOFF_FIELDS
    .filter((key) => !text(extracted[key]))
    .map((key) => INSPECTION_HANDOFF_FIELD_LABELS[key]);
  const reportedMissing = Array.isArray(payload.missing_critical) ? payload.missing_critical.map(text).filter(Boolean) : [];
  const needsConfirmation = fields
    .filter((row) => row.confidence !== "high")
    .map((row) => INSPECTION_HANDOFF_FIELD_LABELS[row.key]);
  return {
    summary: text(payload.summary),
    fields,
    extracted,
    missing_critical: [...new Set([...missingCritical, ...reportedMissing])],
    needs_confirmation: [...new Set([
      ...needsConfirmation,
      ...(Array.isArray(payload.needs_confirmation) ? payload.needs_confirmation.map(text).filter(Boolean) : []),
    ])],
  };
}

export function applyInspectionExtractionToDraft(draft = {}, payload = {}) {
  const normalized = normalizeInspectionExtraction(payload);
  const next = { ...draft };
  normalized.fields.forEach(({ key, value }) => {
    if (value) next[key] = value;
  });
  if (!text(next.property_name) && text(next.customer_name)) next.property_name = next.customer_name;
  return { draft: next, extraction: normalized };
}

export function inspectionExtractionReadiness(draft = {}, extraction = {}) {
  const missing = CRITICAL_INSPECTION_HANDOFF_FIELDS
    .filter((key) => !text(draft[key]))
    .map((key) => INSPECTION_HANDOFF_FIELD_LABELS[key]);
  const lowConfidence = (extraction.fields || [])
    .filter((row) => row.confidence === "low")
    .map((row) => INSPECTION_HANDOFF_FIELD_LABELS[row.key] || row.key);
  return { ready: missing.length === 0, missing, lowConfidence: [...new Set(lowConfidence)] };
}
