import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const loaderSource = readFileSync(new URL("./DeferredGoogleMapsLoader.jsx", import.meta.url), "utf8");

test("Google Maps loads only inside estimating and travel workspaces", () => {
  assert.match(source, /const GOOGLE_MAPS_WORKSPACES = new Set\(\["tpo", "sprayFoam", "shingle", "tile", "coating", "maintenance", "repair"\]\)/);
  assert.match(source, /const DeferredGoogleMapsLoader = React\.lazy\(\(\) => import\("\.\/DeferredGoogleMapsLoader\.jsx"\)\)/);
  assert.match(loaderSource, /const \{ isLoaded, loadError \} = useLoadScript/);
  assert.match(source, /const shouldLoadGoogleMaps = GOOGLE_MAPS_WORKSPACES\.has\(activeTemplate\)/);
  assert.match(source, /shouldLoadGoogleMaps \? \(/);
  assert.match(source, /<React\.Suspense fallback=\{null\}>[\s\S]*?<DeferredGoogleMapsLoader onStatusChange=\{setGoogleMapsStatus\} \/>[\s\S]*?<\/React\.Suspense>/);
});

test("the application shell no longer starts the Maps hook unconditionally", () => {
  const appStart = source.indexOf("function App() {");
  const loaderState = source.indexOf("const [googleMapsStatus", appStart);
  const appSource = source.slice(appStart);

  assert.ok(loaderState > appStart);
  assert.doesNotMatch(appSource, /useLoadScript/);
  assert.match(appSource, /window\.google\?\.maps/);
});

test("the initial application module does not import the Google Maps package", () => {
  assert.doesNotMatch(source, /from "@react-google-maps\/api"/);
  assert.match(loaderSource, /from "@react-google-maps\/api"/);
  assert.match(loaderSource, /GOOGLE_MAPS_LIBRARIES/);
});
