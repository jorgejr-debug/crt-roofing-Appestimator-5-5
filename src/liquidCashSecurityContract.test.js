import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase_migration.sql", import.meta.url), "utf8");
const requestFunction = readFileSync(new URL("../supabase/functions/request-liquid-cash-code/index.ts", import.meta.url), "utf8");
const verifyFunction = readFileSync(new URL("../supabase/functions/verify-liquid-cash-code/index.ts", import.meta.url), "utf8");

test("RLS excludes liquid cash from direct authenticated reads and writes", () => {
  const secureStage = migration.slice(migration.indexOf("Secure liquid-cash email-code reveal"));
  assert.match(secureStage, /FOR SELECT TO authenticated[\s\S]*record_type <> 'liquid_cash'/);
  assert.match(secureStage, /FOR INSERT TO authenticated[\s\S]*record_type <> 'liquid_cash'/);
  assert.match(secureStage, /FOR UPDATE TO authenticated[\s\S]*record_type <> 'liquid_cash'/);
});

test("challenge tables are not directly available to browser roles", () => {
  assert.match(migration, /REVOKE ALL ON TABLE public\.liquid_cash_access_challenges FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.liquid_cash_reveal_sessions FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.liquid_cash_audit_events FROM PUBLIC, anon, authenticated/);
});

test("request and verify responses cannot contain the balance", () => {
  assert.doesNotMatch(requestFunction, /company_financial_records|currentLiquidBalance/);
  assert.doesNotMatch(verifyFunction, /company_financial_records|currentLiquidBalance/);
});

test("database contract fixes attempts and reveal lifetime", () => {
  assert.match(migration, /max_attempts integer NOT NULL DEFAULT 5 CHECK \(max_attempts = 5\)/);
  assert.match(migration, /clock_timestamp\(\) \+ interval '60 seconds'/);
  assert.match(migration, /event_type, metadata[\s\S]*'verification_failed'/);
  assert.match(migration, /'verification_succeeded'/);
  assert.match(migration, /'reveal_started'/);
});

