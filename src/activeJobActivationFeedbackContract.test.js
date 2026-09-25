import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const start = source.indexOf("const handleMoveApprovedJobToActive = async (job) =>");
const end = source.indexOf("\n  const handleRestoreArchivedJob", start);
const moveSource = source.slice(start, end);

test("moving an approved job to active locks duplicate transitions", () => {
  assert.match(moveSource, /if \(!job \|\| !authUser\?\.key \|\| activeJobMutationKey\) return;/);
  assert.match(moveSource, /setActiveJobMutationKey\(`activate:\$\{job\.id\}`\)/);
  assert.match(moveSource, /finally \{\s*setActiveJobMutationKey\(""\);/);
  assert.match(source, /disabled=\{Boolean\(activeJobMutationKey\)\}[\s\S]*?activeJobMutationKey === `activate:\$\{job\.id\}` \? "Moving…" : "Move to Active Jobs"/);
});

test("moving to active reports success only after refreshed job lists arrive", () => {
  const refreshIndex = moveSource.indexOf("fetchSharedJobsFromSupabase()");
  const refreshCheck = moveSource.indexOf("if (refreshed.error) throw new Error", refreshIndex);
  const successIndex = moveSource.indexOf("moved to Active Jobs.");

  assert.ok(refreshIndex >= 0 && refreshIndex < refreshCheck && refreshCheck < successIndex);
  assert.match(moveSource, /setSessionMessageType\("error"\)/);
});
