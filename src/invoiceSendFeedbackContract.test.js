import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./InvoiceQueue.jsx", import.meta.url), "utf8");

test("invoice sending asks for confirmation before changing invoice status", () => {
  const sendStart = source.indexOf("const sendInvoice = async () =>");
  const sendEnd = source.indexOf("\n  return (", sendStart);
  const sendSource = source.slice(sendStart, sendEnd);
  const confirmIndex = sendSource.indexOf("window.confirm");
  const persistIndex = sendSource.indexOf('persistRequest("Ready to Send")');

  assert.ok(confirmIndex >= 0, "send workflow should ask for confirmation");
  assert.ok(persistIndex > confirmIndex, "invoice status must not change before confirmation");
});

test("invoice sending locks the action and reports the final database or email result", () => {
  assert.match(source, /if \(!selected \|\| saving\) return;/);
  assert.match(source, /disabled=\{saving \|\| selected\.status === "Sent"\}/);
  assert.match(source, /saving \? "Sending…" : "Send Invoice to Customer"/);
  assert.match(source, /Invoice sent to the customer, Natalia was copied, and Waiting on Payment was updated\./);
  assert.match(source, /Invoice was not sent because its latest changes could not be saved:/);
});

test("invoice result feedback is not cleared by the post-save queue refresh", () => {
  assert.doesNotMatch(source, /setDraft\(createDraft\(selected \|\| \{\}\)\);\s*setMessage\(""\);/);
  assert.equal((source.match(/<ActionFeedback /g) || []).length, 1);
  assert.doesNotMatch(source, /message \? <div className=\{messageType/);
});
