import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const component = fs.readFileSync(new URL("./AccountAccessVault.jsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260908143000_secure_account_access_vault.sql", import.meta.url), "utf8");
const edgeFunction = fs.readFileSync(new URL("../supabase/functions/account-access-vault/index.ts", import.meta.url), "utf8");

test("account access is available to employees without exposing tables to browser roles", () => {
  assert.match(app, /key: "accountAccess", label: "Account Access"/);
  assert.match(app, /<AccountAccessVault supabase=\{supabase\}/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(migration, /REVOKE ALL ON TABLE public\.credential_vault_entries FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(component, /from\("credential_vault_entries"\)/);
});

test("credentials are encrypted with a server-only key", () => {
  assert.match(edgeFunction, /ACCOUNT_VAULT_ENCRYPTION_KEY/);
  assert.match(edgeFunction, /AES-GCM/);
  assert.match(migration, /encrypted_secret text NOT NULL/);
  assert.doesNotMatch(migration, /password text/i);
});

test("catalog and item access require separate approvals with no self approval", () => {
  assert.match(migration, /request_type IN \('catalog', 'item'\)/);
  assert.match(edgeFunction, /Catalog approval is required first/);
  assert.match(edgeFunction, /neq\("requester_id", profile\.id\)/);
  assert.match(edgeFunction, /request_type === "catalog" \? 30 : 5/);
});

test("revealed credentials automatically hide after sixty seconds and are audited", () => {
  assert.match(edgeFunction, /visible_seconds: 60/);
  assert.match(edgeFunction, /action: "credential_revealed"/);
  assert.match(component, /Reveal for 60 seconds/);
  assert.match(component, /setRevealed\(null\)/);
});

test("Jorge and Natalia receive access approval requests", () => {
  assert.match(edgeFunction, /jorgejr@crtroofing\.com/);
  assert.match(edgeFunction, /natalia@crtroofing\.com/);
  assert.match(edgeFunction, /RESEND_API_KEY/);
});
