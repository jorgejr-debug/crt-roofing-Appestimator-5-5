import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./SubcontractorCompliance.jsx", import.meta.url), "utf8");

test("vendor saves lock repeated actions and use one feedback surface", () => {
  assert.match(source, /const save = async \(\) => \{\s*if \(busy\) return;/);
  assert.match(source, /disabled=\{busy\}[\s\S]*Saving\.\.\./);
  assert.equal((source.match(/<ActionFeedback /g) || []).length, 1);
  assert.doesNotMatch(source, /statusMessage proposalSuccess/);
  assert.doesNotMatch(source, /statusMessage dangerMessage/);
});

test("vendor drag, paste, and browse files receive the same validation", () => {
  assert.match(source, /validateSubcontractorDocument\(file\)/);
  assert.match(source, /setError\(invalid\)/);
  assert.match(source, /FileDropZone[\s\S]*onFiles=\{addCoiFiles\}/);
});
