import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("authentication startup cannot remain loading indefinitely", () => {
  assert.match(source, /const startupTimeout = window\.setTimeout/);
  assert.match(source, /sign-in check took too long/);
  assert.match(source, /}, 12000\);/);
  assert.match(source, /window\.clearTimeout\(startupTimeout\)/);
});

test("signed-in users can continue if profile details stall", () => {
  assert.match(source, /const profileTimeout = window\.setTimeout/);
  assert.match(source, /mapAuthUserFromSession\(session\.user, null\)/);
  assert.match(source, /Some profile details are still loading/);
  assert.match(source, /}, 8000\);/);
});

test("session lookup failures leave the loading screen with guidance", () => {
  assert.match(source, /supabase\.auth\.getSession\(\)[\s\S]*?\.catch\(\(\) =>/);
  assert.match(source, /portal could not reach the sign-in service/);
  assert.match(source, /finishAuthLoading\(\)/);
});
