import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./ProposalRequests.css", import.meta.url), "utf8");

test("proposal submission shows accessible success and error feedback beside the action", () => {
  assert.match(source, /submissionNotice/);
  assert.match(source, /Sending…/);
  assert.match(source, /Sent ✓/);
  assert.match(source, /Not sent:/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(styles, /\.proposalSubmitNotice\.success/);
  assert.match(styles, /\.proposalSubmitNotice\.error/);
});

test("proposal submission stays on errors and returns to the top after success", () => {
  assert.match(source, /if \(result\.error\) throw result\.error/);
  assert.match(source, /Proposal Request successfully submitted to Daniela/);
  assert.match(source, /window\.scrollTo\(\{ top: 0, behavior: "smooth" \}\)/);
  assert.match(source, /Proposal Request was not sent:/);
});
