import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  APPROVED_JOB_ATTACHMENT_MAX_BYTES,
  buildApprovedJobAttachmentPath,
  createApprovedJobAttachmentRecord,
  formatAttachmentSize,
  validateApprovedJobAttachment,
} from "./approvedJobAttachments.js";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const migrationSource = fs.readFileSync(
  new URL("../supabase/migrations/20260827224000_approved_job_attachments.sql", import.meta.url),
  "utf8",
);

test("accepts supported daily job attachments and rejects unsafe files", () => {
  assert.equal(validateApprovedJobAttachment({ name: "roof.pdf", type: "application/pdf", size: 1000 }), "");
  assert.match(validateApprovedJobAttachment({ name: "script.exe", type: "application/x-msdownload", size: 1000 }), /must be a JPG/);
  assert.match(validateApprovedJobAttachment({ name: "large.pdf", type: "application/pdf", size: APPROVED_JOB_ATTACHMENT_MAX_BYTES + 1 }), /larger than 15 MB/);
});

test("builds a private user-scoped storage path", () => {
  assert.equal(
    buildApprovedJobAttachmentPath({ userId: "user-1", jobId: "job:44", dayId: "day 2", fileName: "Roof Photo #1.jpg", timestamp: 123 }),
    "user-1/job-44/day-2/123-Roof-Photo-1.jpg",
  );
});

test("stores attachment metadata without embedding file contents", () => {
  const record = createApprovedJobAttachmentRecord(
    { name: "roof.pdf", type: "application/pdf", size: 2048 },
    "user/job/day/roof.pdf",
    { id: "attachment-1", uploadedAt: "2026-08-27T22:00:00.000Z", uploadedBy: "Jorge" },
  );
  assert.deepEqual(record, {
    id: "attachment-1",
    fileName: "roof.pdf",
    storagePath: "user/job/day/roof.pdf",
    contentType: "application/pdf",
    fileSize: 2048,
    uploadedAt: "2026-08-27T22:00:00.000Z",
    uploadedBy: "Jorge",
  });
  assert.equal(formatAttachmentSize(record.fileSize), "2 KB");
});

test("daily progress uses a working attachment picker backed by private editor-only storage", () => {
  assert.match(appSource, /onChange=\{\(event\) => handleApprovedProgressAttachmentUpload\(day\.id, event\)\}/);
  assert.doesNotMatch(appSource, /Placeholder for future photo\/document upload/);
  assert.match(migrationSource, /'approved-job-attachments',\s*'approved-job-attachments',\s*false/);
  assert.match(migrationSource, /approved_job_attachments_editor_read[\s\S]*public\.is_shared_job_editor\(\)/);
});
