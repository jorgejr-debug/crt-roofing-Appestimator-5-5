import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { createProposalRequestPdf, createProposalRequestZip, proposalRequestExportBase, safeExportName } from "./proposalRequestExport.js";

test("proposal request export names are organized and filesystem safe", () => {
  assert.equal(safeExportName("PR-12 / 123 Main St."), "PR-12-123-Main-St.");
  assert.equal(proposalRequestExportBase({ request_number: 12, property_name: "ABC Apartments" }), "PR-12-ABC-Apartments");
});

test("proposal request PDF includes all supplied intake groups and attachment names", () => {
  const bytes = createProposalRequestPdf({
    request: { request_number: 12, property_name: "ABC Apartments", submitted_at: "2026-09-01T12:00:00Z", scope_of_work: "Install SPF roofing", deposit_required: true },
    salespersonName: "Ivan",
    fieldGroups: [["Scope Information", [["scope_of_work", "Detailed scope of work"]]]],
    attachments: [{ file_name: "roof-photo.jpg" }],
  });
  assert.ok(bytes.byteLength > 1000);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
});

test("complete ZIP contains the PDF, README, and original attachments", async () => {
  const supabase = { storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "data:text/plain;base64,aGVsbG8=" }, error: null }) }) } };
  const request = { request_number: 7, property_name: "Test Job" };
  const blob = await createProposalRequestZip({ supabase, request, salespersonName: "Chris", fieldGroups: [], attachments: [{ storage_path: "request/photo.txt", file_name: "photo.txt" }] });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.ok(zip.file("PR-7-Test-Job/PR-7-Test-Job-Proposal-Request.pdf"));
  assert.ok(zip.file("PR-7-Test-Job/README.txt"));
  assert.equal(await zip.file("PR-7-Test-Job/Attachments/photo.txt").async("text"), "hello");
});
