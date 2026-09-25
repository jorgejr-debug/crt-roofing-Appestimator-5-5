import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("customer conversion persists the milestone before reporting success", () => {
  assert.match(appSource, /const convertCrmLeadToCustomer = async \(\) =>/);
  assert.match(appSource, /const conversionResult = await upsertCrmLeadToSupabase\(convertedLead, authUser\)/);
  assert.match(appSource, /if \(conversionResult\?\.error\)[\s\S]*The lead was not converted because shared CRM sync failed/);
  assert.match(appSource, /Lead conversion saved to the shared CRM/);
});

test("legacy customer notes and reminders disclose their browser-only scope", () => {
  assert.match(appSource, /Local Customer Notes/);
  assert.match(appSource, /Local Reminders/);
  assert.match(appSource, /Do not rely on this section for team handoff/);
  assert.match(appSource, /create a task in Tasks & Messages/);
});
