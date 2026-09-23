import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/extract-inspection-handoff/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260923103000_inspection_handoff_extraction.sql", import.meta.url), "utf8");
const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");

test("PLAUD extraction stays behind authenticated server-side controls", () => {
  assert.match(edge, /auth\.getUser/);
  assert.match(edge, /OPENAI_API_KEY/);
  assert.match(edge, /store:\s*false/);
  assert.match(edge, /Never infer, calculate, or invent/);
  assert.match(edge, /customer_name:\s*String\(supplied\.customer_name/);
  assert.doesNotMatch(edge, /supplied\.pricing/);
  assert.match(config, /\[functions\.extract-inspection-handoff\][\s\S]*verify_jwt = false/);
});

test("Ivan must review and confirm before an extracted handoff is sent", () => {
  assert.match(ui, /Organize PLAUD Inspection/);
  assert.match(ui, /I reviewed the organized inspection/);
  assert.match(ui, /inspectionExtraction && !inspectionConfirmationValid/);
  assert.match(ui, /save_confirmed_inspection_extraction/);
  assert.match(migration, /IF NOT p_confirmed THEN RAISE EXCEPTION/);
  assert.match(migration, /inspection_extraction_confirmed/);
});

test("Daniela receives source evidence and the original transcript", () => {
  assert.match(ui, /PLAUD Inspection Packet/);
  assert.match(ui, /Original PLAUD summary or transcript/);
  assert.match(migration, /inspection_transcript text/);
  assert.match(migration, /inspection_confirmed_by/);
});
