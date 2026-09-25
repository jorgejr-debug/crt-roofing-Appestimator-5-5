import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("lead saves wait for shared CRM confirmation before showing success", () => {
  assert.match(appSource, /const saveCrmLeadDraft = async/);
  assert.match(appSource, /setSessionMessageType\("info"\);[\s\S]*Saving lead to the shared CRM/);
  assert.match(appSource, /const result = await upsertCrmLeadToSupabase\(nextLead, authUser\)/);
  assert.match(appSource, /setCrmLeadSyncStatus\("saved"\);[\s\S]*setSessionMessageType\("success"\)/);
});

test("lead save failures do not display a green completion state", () => {
  assert.match(appSource, /if \(result\?\.error\)[\s\S]*setSessionMessageType\("error"\)[\s\S]*return null/);
  assert.match(appSource, /disabled=\{crmLeadSyncStatus === "saving"\}/);
  assert.match(appSource, /crmLeadSyncStatus === "saving" \? "Saving…" : "Save Lead"/);
});

test("quick lead actions lock while the shared save is pending", () => {
  assert.match(appSource, /disabled=\{crmInspectionSending \|\| crmLeadWorkOrderUploading \|\| crmLeadSyncStatus === "saving"\}/);
  assert.match(appSource, /crmLeadSyncStatus === "saving"[\s\S]*\? "Saving…"/);
  assert.match(appSource, /className="dangerButton" disabled=\{crmLeadSyncStatus === "saving"\}/);
});

test("lead qualification actions lock while the shared save is pending", () => {
  assert.match(appSource, /const handleCrmLeadAction = async \(action\) => \{\s*if \(crmLeadSyncStatus === "saving"\) return;/);
  assert.match(appSource, /const convertCrmLeadToCustomer = async \(\) => \{\s*if \(crmLeadSyncStatus === "saving"\) return;/);
  assert.match(appSource, /disabled=\{crmInspectionSending \|\| crmLeadSyncStatus === "saving"\}/);
  assert.match(appSource, /className="secondaryButton" disabled=\{crmLeadSyncStatus === "saving"\} onClick=\{convertCrmLeadToCustomer\}/);
  assert.match(appSource, /className="dangerButton" disabled=\{crmLeadSyncStatus === "saving"\} onClick=\{\(\) => startNewCrmLeadDraft\(\)\}/);
});
