import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("CRM does not present filename-only metadata as a successful document upload", () => {
  assert.doesNotMatch(appSource, /handleCrmCustomerFileUpload/);
  assert.doesNotMatch(appSource, /notes: "Uploaded locally"/);
  assert.match(appSource, /Customer-record file storage is not connected/);
  assert.match(appSource, /Legacy references below contain filenames only/);
});

test("CRM directs shared documents into protected lead and proposal workflows", () => {
  assert.match(appSource, /Open Quick Lead Capture/);
  assert.match(appSource, /Open Proposal Requests/);
});
