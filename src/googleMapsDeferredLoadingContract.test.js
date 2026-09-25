import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("Google Maps loads only inside estimating and travel workspaces", () => {
  assert.match(source, /const GOOGLE_MAPS_WORKSPACES = new Set\(\["tpo", "sprayFoam", "shingle", "tile", "coating", "maintenance", "repair"\]\)/);
  assert.match(source, /function DeferredGoogleMapsLoader/);
  assert.match(source, /const \{ isLoaded, loadError \} = useLoadScript/);
  assert.match(source, /const shouldLoadGoogleMaps = GOOGLE_MAPS_WORKSPACES\.has\(activeTemplate\)/);
  assert.match(source, /shouldLoadGoogleMaps \? <DeferredGoogleMapsLoader onStatusChange=\{setGoogleMapsStatus\} \/> : null/);
});

test("the application shell no longer starts the Maps hook unconditionally", () => {
  const appStart = source.indexOf("function App() {");
  const loaderState = source.indexOf("const [googleMapsStatus", appStart);
  const appSource = source.slice(appStart);

  assert.ok(loaderState > appStart);
  assert.doesNotMatch(appSource, /const \{ isLoaded, loadError \} = useLoadScript/);
  assert.match(appSource, /window\.google\?\.maps/);
});
