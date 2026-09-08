export const LIQUID_CASH_RECORD_TYPE = "liquid_cash";
export const LIQUID_CASH_CODE_TTL_SECONDS = 5 * 60;
export const LIQUID_CASH_MAX_ATTEMPTS = 5;
export const LIQUID_CASH_REVEAL_SECONDS = 60;

export function canRequestLiquidCashCode(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "cfo";
}

export function stripLiquidCashRecords(rows = []) {
  return (Array.isArray(rows) ? rows : []).filter(
    (row) => String(row?.record_type || row?.recordType || "").trim().toLowerCase() !== LIQUID_CASH_RECORD_TYPE,
  );
}

export function getRevealSecondsRemaining(expiresAt, nowMs = Date.now()) {
  const expiryMs = new Date(expiresAt || 0).getTime();
  if (!Number.isFinite(expiryMs)) return 0;
  return Math.max(0, Math.ceil((expiryMs - nowMs) / 1000));
}

export function evaluateVerificationAttempt({
  status = "pending",
  expiresAt,
  attemptCount = 0,
  storedCodeHash = "",
  providedCodeHash = "",
  nowMs = Date.now(),
  maxAttempts = LIQUID_CASH_MAX_ATTEMPTS,
} = {}) {
  if (status !== "pending") {
    return { outcome: status === "verified" ? "already_used" : status, attemptCount, attemptsRemaining: 0 };
  }
  if (new Date(expiresAt || 0).getTime() <= nowMs) {
    return { outcome: "expired", attemptCount, attemptsRemaining: 0 };
  }
  if (attemptCount >= maxAttempts) {
    return { outcome: "exhausted", attemptCount, attemptsRemaining: 0 };
  }
  if (!storedCodeHash || storedCodeHash !== providedCodeHash) {
    const nextAttemptCount = attemptCount + 1;
    return {
      outcome: nextAttemptCount >= maxAttempts ? "exhausted" : "failed",
      attemptCount: nextAttemptCount,
      attemptsRemaining: Math.max(0, maxAttempts - nextAttemptCount),
    };
  }
  return {
    outcome: "success",
    attemptCount,
    attemptsRemaining: Math.max(0, maxAttempts - attemptCount),
  };
}
