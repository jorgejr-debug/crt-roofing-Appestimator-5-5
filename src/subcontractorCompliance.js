export const SUBCONTRACTOR_COI_BUCKET = "subcontractor-coi";

export function daysUntilDate(value, now = new Date()) {
  if (!value) return null;
  const target = new Date(`${value}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function getSubcontractorComplianceStatus(record = {}, now = new Date()) {
  const days = daysUntilDate(record.workers_comp_expiration_date, now);
  if (!record.is_active) return { key: "inactive", label: "Inactive", tone: "neutral", days };
  if (record.license_status === "licensed" && !String(record.license_number || "").trim()) return { key: "missing_license", label: "License Number Missing", tone: "danger", days };
  if (!record.workers_comp_active) return { key: "no_workers_comp", label: "Workers' Comp Inactive", tone: "danger", days };
  if (!record.coi_names_crt_insured || !String(record.coi_storage_path || "").trim()) return { key: "missing_coi", label: "Updated COI Required", tone: "danger", days };
  if (days === null) return { key: "missing_expiration", label: "Expiration Date Missing", tone: "danger", days };
  if (days < 0) return { key: "expired", label: "Workers' Comp Expired", tone: "danger", days };
  if (days <= 30) return { key: "expiring", label: `Expires in ${days} day${days === 1 ? "" : "s"}`, tone: "warning", days };
  return { key: "compliant", label: "Compliant", tone: "success", days };
}

export function validateSubcontractor(record = {}) {
  const missing = [];
  if (!String(record.company_name || "").trim()) missing.push("Company name");
  if (!String(record.trade || "").trim()) missing.push("Trade / service");
  if (!String(record.contact_name || "").trim()) missing.push("Contact name");
  if (record.license_status === "licensed" && !String(record.license_number || "").trim()) missing.push("License number");
  if (record.workers_comp_active && !record.workers_comp_expiration_date) missing.push("Workers' compensation expiration date");
  return { valid: missing.length === 0, missing };
}

export function normalizeSubcontractorPayload(record = {}) {
  return {
    ...record,
    license_expiration_date: String(record.license_expiration_date || "").trim() || null,
    workers_comp_expiration_date: record.workers_comp_active
      ? (String(record.workers_comp_expiration_date || "").trim() || null)
      : null,
  };
}

export function buildCoiStoragePath(userId, subcontractorId, fileName) {
  const safeName = String(fileName || "coi.pdf").replace(/[^a-z0-9._-]/gi, "_");
  return `${userId}/${subcontractorId}/${Date.now()}-${safeName}`;
}
