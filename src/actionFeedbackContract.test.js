import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const componentSource = fs.readFileSync(new URL("./ActionFeedback.jsx", import.meta.url), "utf8");
const styleSource = fs.readFileSync(new URL("./ActionFeedback.css", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("action feedback distinguishes success, progress, warning, and failure", () => {
  assert.match(componentSource, /tone === "warning"/);
  assert.match(componentSource, /tone === "info"/);
  assert.match(styleSource, /\.actionFeedbackToast\.warning/);
  assert.match(styleSource, /\.actionFeedbackToast\.info/);
});

test("pending app actions do not appear as successful submissions", () => {
  assert.match(appSource, /tone=\{sessionMessageType \|\| "info"\}/);
  assert.doesNotMatch(appSource, /tone=\{sessionMessageType === "error" \? "error" : "success"\}/);
});
