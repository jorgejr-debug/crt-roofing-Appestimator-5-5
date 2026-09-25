import { readAppSource } from "../tests/appSource.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = readAppSource();

test("customer conversion persists the milestone before reporting success", () => {
  assert.match(appSource, /const convertCrmLeadToCustomer = async \(\) =>/);
  assert.match(appSource, /const conversionResult = await upsertCrmLeadToSupabase\(convertedLead, authUser\)/);
  assert.match(appSource, /if \(conversionResult\?\.error\)[\s\S]*The lead was not converted because shared CRM sync failed/);
  assert.match(appSource, /Lead and customer record saved to the shared CRM/);
});

test("customer notes and reminders use shared CRM saves", () => {
  assert.match(appSource, /Shared Customers/);
  assert.match(appSource, /Shared Reminders/);
  assert.match(appSource, /await upsertCrmCustomerToSupabase\(nextCustomer, authUser\)/);
  assert.match(appSource, /await upsertCrmFollowupToSupabase\(nextFollowup, authUser\)/);
  assert.match(appSource, /Lead and customer record saved to the shared CRM\./);
});
