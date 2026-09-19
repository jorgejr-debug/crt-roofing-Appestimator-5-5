const CLOSED_LEAD_STATUSES = new Set(["Lost", "Not Qualified"]);

export function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

export function validateQuickLead(lead = {}) {
  const contact = String(lead.contactName || "").trim();
  const namedContact = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  const company = String(lead.companyName || "").trim();
  const phone = normalizePhone(lead.phone);
  const email = String(lead.email || "").trim();
  const address = String(lead.propertyAddress || "").trim();
  const errors = [];

  if (!contact && !namedContact && !company) errors.push("Enter a contact or company name.");
  if (!phone && !email && !address) errors.push("Enter a phone number, email, or property address.");

  return { valid: errors.length === 0, errors };
}

export function findPotentialDuplicateLead(leads = [], candidate = {}) {
  const candidatePhone = normalizePhone(candidate.phone);
  const candidateAddress = String(candidate.propertyAddress || "").trim().toLowerCase();
  if (!candidatePhone && !candidateAddress) return null;
  return leads.find((lead) => {
    if (String(lead.id || "") === String(candidate.id || "")) return false;
    const phoneMatch = candidatePhone && normalizePhone(lead.phone) === candidatePhone;
    const addressMatch = candidateAddress && String(lead.propertyAddress || "").trim().toLowerCase() === candidateAddress;
    return phoneMatch || addressMatch;
  }) || null;
}

export function findInspectionAssignee(profiles = []) {
  const normalized = profiles.map((profile) => ({
    ...profile,
    email: String(profile.email || "").trim().toLowerCase(),
    fullName: String(profile.full_name || profile.fullName || "").trim().toLowerCase(),
    role: String(profile.role || "").trim().toLowerCase(),
  }));

  return normalized.find((profile) => profile.email === "ivan@crtroofing.com")
    || normalized.find((profile) => profile.fullName === "ivan solano")
    || normalized.find((profile) => profile.fullName.startsWith("ivan ") && ["estimator", "salesperson", "admin"].includes(profile.role))
    || null;
}

export function buildInspectionTask(lead = {}) {
  const contactName = String(
    lead.contactName
      || [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim()
      || lead.companyName
      || "New caller",
  ).trim();
  const urgency = String(lead.urgency || "Normal").trim().toLowerCase();
  const detailLines = [
    "Please contact this customer to schedule a roof inspection.",
    `Contact: ${contactName}`,
    lead.companyName && lead.companyName !== contactName ? `Company: ${lead.companyName}` : "",
    lead.phone ? `Phone: ${lead.phone}` : "",
    lead.email ? `Email: ${lead.email}` : "",
    lead.propertyAddress ? `Property address: ${lead.propertyAddress}` : "",
    lead.roofingServiceNeeded ? `Requested service: ${lead.roofingServiceNeeded}` : "Requested service: Roof inspection",
    lead.bestTimeToCall ? `Best time to call: ${lead.bestTimeToCall}` : "",
    lead.description ? `Office notes: ${lead.description}` : "",
    lead.originatorName || lead.originatorEmail
      ? `Sent by: ${lead.originatorName || lead.originatorEmail}`
      : "",
  ].filter(Boolean);

  return {
    title: `Inspection Request: ${contactName}`,
    description: detailLines.join("\n"),
    priority: ["high", "rush", "urgent", "emergency"].includes(urgency) ? "high" : "normal",
  };
}

export function calculateLeadKpis(leads = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - ((day + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const originatorEmail = String(options.originatorEmail || "").trim().toLowerCase();
  const originatorId = String(options.originatorId || "").trim();
  const weeklyInspectionTarget = Math.max(0, Number(options.weeklyInspectionTarget) || 0);

  const attributed = leads.filter((lead) => {
    if (!originatorEmail && !originatorId) return true;
    const emailMatches = originatorEmail && String(lead.originatorEmail || "").trim().toLowerCase() === originatorEmail;
    const idMatches = originatorId && String(lead.originatorId || "") === originatorId;
    return emailMatches || idMatches;
  });
  const thisWeek = attributed.filter((lead) => new Date(lead.createdAt || 0) >= weekStart);
  const qualified = thisWeek.filter((lead) => lead.qualificationStatus === "qualified" || lead.qualifiedAt);
  const inspectionReady = thisWeek.filter((lead) => lead.acceptedForInspectionAt || lead.appointmentDate);
  const staleCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const stale = attributed.filter((lead) => {
    if (CLOSED_LEAD_STATUSES.has(String(lead.leadStatus || ""))) return false;
    return new Date(lead.lastActivityDate || lead.updatedAt || lead.createdAt || 0) < staleCutoff;
  });
  const processCompliant = attributed.filter((lead) => {
    const progressed = ["Proposal Sent", "Approved"].includes(String(lead.leadStatus || ""));
    return !progressed || Boolean(lead.qualifiedAt || lead.qualificationStatus === "qualified");
  }).length;

  return {
    total: attributed.length,
    capturedThisWeek: thisWeek.length,
    qualifiedThisWeek: qualified.length,
    inspectionReadyThisWeek: inspectionReady.length,
    qualificationRate: thisWeek.length ? qualified.length / thisWeek.length : 0,
    capacityCoverage: weeklyInspectionTarget ? inspectionReady.length / weeklyInspectionTarget : null,
    weeklyInspectionTarget,
    staleCount: stale.length,
    processComplianceRate: attributed.length ? processCompliant / attributed.length : 1,
  };
}
