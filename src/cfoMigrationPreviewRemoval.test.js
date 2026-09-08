import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("CFO dashboard no longer exposes the obsolete local migration preview", () => {
  assert.doesNotMatch(source, /Build local migration preview/);
  assert.doesNotMatch(source, /buildCfoLocalMigrationPreview/);
  assert.doesNotMatch(source, /cfoMigrationPreviewRows/);
});
