import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const start = source.indexOf("const submitInvoiceHandoff = async () =>");
const end = source.indexOf("\n  const handleMoveApprovedJobToActive", start);
const handoffSource = source.slice(start, end);

test("invoice handoff locks duplicate submissions and always releases the control", () => {
  assert.match(handoffSource, /!authUser\?\.key \|\| invoiceHandoffSaving/);
  assert.match(handoffSource, /setInvoiceHandoffSaving\(true\)/);
  assert.match(handoffSource, /finally \{\s*setInvoiceHandoffSaving\(false\);/);
  assert.match(source, /disabled=\{invoiceHandoffSaving\}[\s\S]*?invoiceHandoffSaving \? "Sending…"/);
});

test("invoice handoff confirms both the completed job and Natalia's queue", () => {
  assert.match(handoffSource, /committedRequest = Array\.isArray\(data\) \? data\[0\] : data/);
  assert.match(handoffSource, /fetchSharedJobsFromSupabase\(\)/);
  assert.match(handoffSource, /\.from\("invoice_requests"\)[\s\S]*?\.eq\("id", committedRequest\.id\)/);
  assert.match(handoffSource, /if \(refreshed\.error\) throw new Error/);
  assert.match(handoffSource, /if \(invoiceConfirmation\.error \|\| !invoiceConfirmation\.data\?\.id\)/);
});

test("failed invoice submission preserves the handoff form for correction", () => {
  const catchIndex = handoffSource.indexOf("catch (handoffError)");
  const committedBranch = handoffSource.indexOf("if (committedRequest)", catchIndex);
  const uncommittedBranch = handoffSource.indexOf("} else {", committedBranch);
  const uncommittedSource = handoffSource.slice(uncommittedBranch);

  assert.match(uncommittedSource, /setInvoiceHandoffError\(handoffMessage/);
  assert.doesNotMatch(uncommittedSource, /setInvoiceHandoffDraft\(null\)/);
  assert.doesNotMatch(uncommittedSource, /setInvoiceHandoffJob\(null\)/);
});

test("a committed handoff never invites a duplicate retry when refresh confirmation fails", () => {
  const catchIndex = handoffSource.indexOf("catch (handoffError)");
  const catchSource = handoffSource.slice(catchIndex);

  assert.match(catchSource, /if \(committedRequest\)/);
  assert.match(catchSource, /setInvoiceHandoffJob\(null\)/);
  assert.match(catchSource, /setInvoiceHandoffDraft\(null\)/);
  assert.match(catchSource, /setSessionMessageType\("error"\)/);
});
