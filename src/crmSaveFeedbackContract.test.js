import { readAppSource } from "../tests/appSource.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = readAppSource();

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

test("quick capture reviews possible duplicates before saving or routing", () => {
  assert.match(appSource, /const confirmSeparateCrmLead = \(candidate\) => \{/);
  assert.match(appSource, /Select OK only if this is a separate opportunity\. Select Cancel to review the existing lead instead\./);
  assert.match(appSource, /Opened the existing lead for \$\{duplicateName\}\. No duplicate was created\./);
  assert.match(appSource, /if \(!confirmSeparateCrmLead\(leadToSave\)\) return;/);
  assert.match(appSource, /if \(!confirmSeparateCrmLead\(leadOverride\)\) return;/);
});
