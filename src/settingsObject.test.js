import test from "node:test";
import assert from "node:assert/strict";
import { toPlainObject } from "./settingsObject.js";

test("company settings retain stored prices and travel overrides", () => {
  const settings = { overhead: 17.5, fuelCost: 5.25, trucks: [{ id: "existing" }] };
  assert.equal(toPlainObject(settings), settings);
  assert.deepEqual(toPlainObject(JSON.stringify(settings)), settings);
});

test("invalid settings retain the supplied defaults without spreading invalid values", () => {
  const fallback = { fuelCost: 5 };
  for (const value of [undefined, null, [], 5, true, "invalid", "null", "[]", '"text"']) {
    assert.equal(toPlainObject(value, fallback), fallback);
  }
});
