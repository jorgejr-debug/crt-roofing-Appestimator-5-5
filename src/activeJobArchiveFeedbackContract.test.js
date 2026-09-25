import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("archiving a job requires confirmation and blocks duplicate actions", () => {
  const start = source.indexOf("const handleArchiveActiveJob = async (job) =>");
  const end = source.indexOf("\n  const openInvoiceHandoff", start);
  const archiveSource = source.slice(start, end);

  assert.match(archiveSource, /if \(!job \|\| !authUser\?\.key \|\| activeJobMutationKey\) return;/);
  assert.match(archiveSource, /window\.confirm\(`/);
  assert.match(archiveSource, /setActiveJobMutationKey\(`archive:\$\{job\.id\}`\)/);
  assert.match(archiveSource, /finally \{\s*setActiveJobMutationKey\(""\);/);
  assert.match(source, /activeJobMutationKey === `archive:\$\{job\.id\}` \? "Archiving…" : "Archive"/);
});

test("archive success is shown only after the shared job list refreshes", () => {
  const start = source.indexOf("const handleArchiveActiveJob = async (job) =>");
  const end = source.indexOf("\n  const openInvoiceHandoff", start);
  const archiveSource = source.slice(start, end);
  const refreshCheck = archiveSource.indexOf("if (refreshed.error) throw new Error");
  const successMessage = archiveSource.indexOf("moved to the archive");

  assert.ok(refreshCheck >= 0 && refreshCheck < successMessage);
  assert.match(archiveSource, /setSessionMessageType\("error"\)/);
});

test("restoring a job blocks duplicates and verifies the refreshed list", () => {
  const start = source.indexOf("const handleRestoreArchivedJob = async (job) =>");
  const end = source.indexOf("\n  const openApprovedJobDetail", start);
  const restoreSource = source.slice(start, end);

  assert.match(restoreSource, /if \(!job \|\| !authUser\?\.key \|\| activeJobMutationKey\) return;/);
  assert.match(restoreSource, /setActiveJobMutationKey\(`restore:\$\{job\.id\}`\)/);
  assert.match(restoreSource, /if \(refreshed\.error\) throw new Error/);
  assert.match(restoreSource, /finally \{\s*setActiveJobMutationKey\(""\);/);
  assert.match(source, /activeJobMutationKey === `restore:\$\{job\.id\}` \? "Restoring…" : "Restore"/);
});
