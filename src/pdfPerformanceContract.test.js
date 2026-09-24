import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("the QuickMeasure PDF reader loads only when a PDF is selected", () => {
  assert.doesNotMatch(appSource, /^import \{ getDocument, GlobalWorkerOptions \} from "pdfjs-dist/m);
  assert.match(appSource, /async function loadPdfReader\(\)/);
  assert.match(appSource, /import\("pdfjs-dist\/build\/pdf\.mjs"\)/);
  assert.match(appSource, /const \{ getDocument \} = await loadPdfReader\(\)/);
});
