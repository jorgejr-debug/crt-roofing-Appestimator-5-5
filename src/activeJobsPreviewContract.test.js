import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("dashboard preview uses every shared active-workflow job", () => {
  assert.match(appSource, /const active = activeJobs;/);
  assert.doesNotMatch(appSource, /const active = activeJobs\.filter\(\(job\) => isActiveJobStatus\(job\.status\)\)/);
});

test("In Progress remains recognized as an active display status", () => {
  assert.match(appSource, /ACTIVE_JOB_ACTIVE_STATUSES = new Set\(\[[^\]]*"in progress"/);
});

test("active job previews hand completed jobs to invoicing and retain past job history", () => {
  assert.match(appSource, />\s*Complete Job &amp; Send to Invoicing\s*</);
  assert.match(appSource, /submit_active_job_for_invoicing/);
  assert.match(appSource, /title={`Past Completed Jobs \(\$\{pastCompletedJobs\.length\}\)`}/);
});
