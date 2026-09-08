import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSprayFoamUsage,
  normalizeSprayFoamThickness,
  resolveSprayFoamTravelInputs,
} from "./sprayFoamEstimateRules.js";

test("zero-inch foam thickness creates an acrylic-only estimate with no foam usage", () => {
  assert.equal(normalizeSprayFoamThickness(0), 0);
  assert.deepEqual(calculateSprayFoamUsage(100, 0, 26), {
    thicknessInches: 0,
    yieldPerKit: 0,
    kitsNeeded: 0,
  });
});

test("positive foam thickness still calculates normal foam usage", () => {
  assert.deepEqual(calculateSprayFoamUsage(52, 2, 26), {
    thicknessInches: 2,
    yieldPerKit: 13,
    kitsNeeded: 4,
  });
});

test("spray foam travel falls back to saved miles, estimated days, and truck count", () => {
  assert.deepEqual(resolveSprayFoamTravelInputs({
    oneWayMiles: 0,
    sprayFoamMilesToLocation: 96,
    numberOfJobDays: 0,
    sprayFoamEstimatedCompletionDays: 3,
    numberOfDrivers: 0,
  }, 2), {
    oneWayMiles: 96,
    numberOfJobDays: 3,
    numberOfDrivers: 2,
  });
});
