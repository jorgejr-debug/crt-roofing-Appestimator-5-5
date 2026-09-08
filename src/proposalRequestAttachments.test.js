import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PROPOSAL_REQUEST_FILE_MAX_BYTES,
  buildProposalRequestAttachmentPath,
  proposalRequestAttachmentCategory,
  validateProposalRequestAttachment,
} from "./proposalRequestAttachments.js";

const proposalRequestUi = readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");

test("proposal request intake accepts supported field files", () => {
  for (const file of [
    { name: "roof-photo.heic", type: "image/heic", size: 2000 },
    { name: "roof-report.pdf", type: "application/pdf", size: 3000 },
    { name: "measurements.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 4000 },
    { name: "existing-scope.doc", type: "application/msword", size: 5000 },
  ]) assert.equal(validateProposalRequestAttachment(file), "");
});

test("proposal request intake rejects unsafe and oversized files", () => {
  assert.match(validateProposalRequestAttachment({ name: "installer.exe", size: 100 }), /not a supported/);
  assert.match(validateProposalRequestAttachment({ name: "large.pdf", size: PROPOSAL_REQUEST_FILE_MAX_BYTES + 1 }), /larger than 25 MB/);
});

test("proposal request attachment paths remain scoped to the request", () => {
  assert.equal(buildProposalRequestAttachmentPath("request-1", "Roof Photo #1.jpg", "file-1"), "request-1/file-1-Roof_Photo__1.jpg");
  assert.equal(proposalRequestAttachmentCategory({ type: "image/jpeg" }), "photo");
  assert.equal(proposalRequestAttachmentCategory({ type: "application/pdf" }), "other");
});

test("new Proposal Request form exposes multi-file upload before submission", () => {
  assert.match(proposalRequestUi, /Photos & supporting files/);
  assert.match(proposalRequestUi, /Choose Photos & Files/);
  assert.match(proposalRequestUi, /multiple accept=\{PROPOSAL_REQUEST_FILE_ACCEPT\} onChange=\{selectPendingAttachments\}/);
  assert.match(proposalRequestUi, /uploadFilesToRequest\(saved\.id, filesToUpload\)/);
  assert.match(proposalRequestUi, /Uploading \$\{index \+ 1\} of \$\{files\.length\}/);
  assert.match(proposalRequestUi, /remain selected for retry/);
});
