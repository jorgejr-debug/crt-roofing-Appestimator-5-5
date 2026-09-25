import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("active job issues appear only after the shared save confirms", () => {
  const start = source.indexOf("const saveActiveJobIssue = async () =>");
  const end = source.indexOf("\n  const handleSaveApprovedJob", start);
  const issueSource = source.slice(start, end);
  const saveIndex = issueSource.indexOf("await supabase.rpc");
  const alternateSaveIndex = issueSource.indexOf("await upsertSharedJobToSupabase");
  const confirmedSaveIndex = Math.min(...[saveIndex, alternateSaveIndex].filter((index) => index >= 0));
  const screenUpdateIndex = issueSource.indexOf("setActiveJobs((current)");

  assert.ok(confirmedSaveIndex >= 0, "issue should save to shared job data");
  assert.ok(screenUpdateIndex > confirmedSaveIndex, "issue must not appear locally before shared save confirmation");
  assert.match(issueSource, /Issue was not saved:/);
  assert.doesNotMatch(issueSource, /Issue saved locally but sync failed/);
});

test("active job issue controls lock while saving and preserve the modal on failure", () => {
  assert.match(source, /if \(activeJobIssueSaving\) return;/);
  assert.match(source, /disabled=\{activeJobIssueSaving\}[\s\S]*Saving issue…/);
  assert.match(source, /finally \{\s*setActiveJobIssueSaving\(false\);/);
});
