import { readAppSource } from "../tests/appSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readAppSource();

test("active job detail saves lock duplicate activity updates", () => {
  assert.match(source, /if \(!job \|\| !activeJobEditDraft \|\| !authUser\?\.key \|\| activeJobMutationKey\) return;/);
  assert.match(source, /setActiveJobMutationKey\(`edit:\$\{job\.id\}`\)/);
  assert.match(source, /disabled=\{Boolean\(activeJobMutationKey\)\}[\s\S]*Saving changes…/);
  assert.match(source, /finally \{\s*setActiveJobMutationKey\(""\);/);
});

test("failed active job detail saves retain the edit draft", () => {
  const start = source.indexOf("const handleSaveActiveJobEdit = async (job) =>");
  const end = source.indexOf("\n  const handleArchiveActiveJob", start);
  const editSource = source.slice(start, end);
  const catchIndex = editSource.indexOf("catch (saveError)");
  const resetIndex = editSource.indexOf("setActiveJobEditDraft(null)");

  assert.ok(resetIndex >= 0 && resetIndex < catchIndex, "draft should clear only in the confirmed-success branch");
  assert.doesNotMatch(editSource.slice(catchIndex), /setActiveJobEditDraft\(null\)/);
  assert.match(editSource, /Could not save project changes:/);
});
