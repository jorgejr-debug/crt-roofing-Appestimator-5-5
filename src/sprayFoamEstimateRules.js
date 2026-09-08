function nonnegativeNumber(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export function normalizeSprayFoamThickness(value, fallback = 2) {
  return Math.min(16, nonnegativeNumber(value, fallback));
}

export function calculateSprayFoamUsage(areaSquares, thicknessInches, yieldAtOneInch = 26) {
  const area = nonnegativeNumber(areaSquares, 0);
  const thickness = normalizeSprayFoamThickness(thicknessInches, 0);
  const baseYield = nonnegativeNumber(yieldAtOneInch, 0);
  if (area <= 0 || thickness <= 0 || baseYield <= 0) {
    return { thicknessInches: thickness, yieldPerKit: 0, kitsNeeded: 0 };
  }
  const yieldPerKit = baseYield / thickness;
  return { thicknessInches: thickness, yieldPerKit, kitsNeeded: area / yieldPerKit };
}

export function resolveSprayFoamTravelInputs(inputs = {}, vehicleCount = 1) {
  const enteredMiles = nonnegativeNumber(inputs.oneWayMiles, 0);
  const legacySprayFoamMiles = nonnegativeNumber(inputs.sprayFoamMilesToLocation, 0);
  const enteredDays = Math.round(nonnegativeNumber(inputs.numberOfJobDays, 0));
  const sprayFoamDays = Math.round(nonnegativeNumber(inputs.sprayFoamEstimatedCompletionDays, 0));
  const enteredDrivers = Math.round(nonnegativeNumber(inputs.numberOfDrivers, 0));
  return {
    oneWayMiles: enteredMiles > 0 ? enteredMiles : legacySprayFoamMiles,
    numberOfJobDays: enteredDays > 0 ? enteredDays : sprayFoamDays,
    numberOfDrivers: enteredDrivers > 0 ? enteredDrivers : Math.max(1, Math.round(nonnegativeNumber(vehicleCount, 1))),
  };
}
