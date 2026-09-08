import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dropZone = readFileSync(new URL("./FileDropZone.jsx", import.meta.url), "utf8");
const subcontractorUi = readFileSync(new URL("./SubcontractorCompliance.jsx", import.meta.url), "utf8");

test("shared file control supports browse, drop, and clipboard paste", () => {
  assert.match(dropZone, /onDrop=/);
  assert.match(dropZone, /onPaste=/);
  assert.match(dropZone, /multiple=\{multiple\}/);
});

test("subcontractor form clearly flags the required trade and supports multiple documents", () => {
  assert.match(subcontractorUi, /Enter the subcontractor’s trade or service\./);
  assert.match(subcontractorUi, /aria-invalid=\{invalidFields\.includes\("trade"\)\}/);
  assert.match(subcontractorUi, /placeholder="Example: Hauling, roofing, HVAC, electrical"/);
  assert.match(subcontractorUi, /onFiles=\{addCoiFiles\}/);
  assert.match(subcontractorUi, /subcontractor_documents/);
});
