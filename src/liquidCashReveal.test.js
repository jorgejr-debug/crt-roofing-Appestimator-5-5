import test from "node:test";
import assert from "node:assert/strict";
import {
  LIQUID_CASH_MAX_ATTEMPTS,
  canRequestLiquidCashCode,
  evaluateVerificationAttempt,
  getRevealSecondsRemaining,
  stripLiquidCashRecords,
} from "./liquidCashReveal.js";

test("only CFO and admin roles may request a liquid-cash code", () => {
  assert.equal(canRequestLiquidCashCode("admin"), true);
  assert.equal(canRequestLiquidCashCode("cfo"), true);
  assert.equal(canRequestLiquidCashCode("salesperson"), false);
  assert.equal(canRequestLiquidCashCode("estimator"), false);
  assert.equal(canRequestLiquidCashCode(""), false);
});

test("verification codes expire after five minutes", () => {
  const nowMs = Date.parse("2026-08-24T18:00:00.000Z");
  const result = evaluateVerificationAttempt({
    expiresAt: "2026-08-24T17:59:59.999Z",
    storedCodeHash: "same",
    providedCodeHash: "same",
    nowMs,
  });
  assert.equal(result.outcome, "expired");
});

test("the fifth failed attempt exhausts the challenge", () => {
  const result = evaluateVerificationAttempt({
    expiresAt: "2026-08-24T18:05:00.000Z",
    attemptCount: LIQUID_CASH_MAX_ATTEMPTS - 1,
    storedCodeHash: "expected",
    providedCodeHash: "wrong",
    nowMs: Date.parse("2026-08-24T18:00:00.000Z"),
  });
  assert.deepEqual(result, { outcome: "exhausted", attemptCount: 5, attemptsRemaining: 0 });
});

test("a valid unexpired code succeeds without exposing the balance", () => {
  const result = evaluateVerificationAttempt({
    expiresAt: "2026-08-24T18:05:00.000Z",
    attemptCount: 1,
    storedCodeHash: "expected",
    providedCodeHash: "expected",
    nowMs: Date.parse("2026-08-24T18:00:00.000Z"),
  });
  assert.equal(result.outcome, "success");
  assert.equal(Object.hasOwn(result, "amount"), false);
});

test("the reveal countdown reaches zero exactly at the server expiry", () => {
  const expiresAt = "2026-08-24T18:01:00.000Z";
  assert.equal(getRevealSecondsRemaining(expiresAt, Date.parse("2026-08-24T18:00:00.000Z")), 60);
  assert.equal(getRevealSecondsRemaining(expiresAt, Date.parse("2026-08-24T18:00:59.001Z")), 1);
  assert.equal(getRevealSecondsRemaining(expiresAt, Date.parse(expiresAt)), 0);
  assert.equal(getRevealSecondsRemaining(expiresAt, Date.parse("2026-08-24T18:01:01.000Z")), 0);
});

test("ordinary finance payloads never contain liquid cash rows", () => {
  const result = stripLiquidCashRecords([
    { record_type: "receivable", amount: 2500 },
    { record_type: "liquid_cash", amount: 987654.32 },
    { record_type: "manual", amount: 100 },
  ]);
  assert.deepEqual(result, [
    { record_type: "receivable", amount: 2500 },
    { record_type: "manual", amount: 100 },
  ]);
  assert.equal(JSON.stringify(result).includes("987654.32"), false);
  assert.deepEqual(stripLiquidCashRecords([{ recordType: "liquid_cash", amount: 1 }]), []);
});
