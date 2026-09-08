import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateInHouseLaborBurden,
  calculateLoadedHourlyWage,
  PAYROLL_TAX_RATE,
  TOTAL_LABOR_BURDEN_RATE,
  WORKERS_COMP_RATE,
} from "./laborBurden.js";

test("uses the requested fixed workers comp and payroll tax rates", () => {
  assert.equal(WORKERS_COMP_RATE, 0.5);
  assert.equal(PAYROLL_TAX_RATE, 0.0925);
  assert.equal(TOTAL_LABOR_BURDEN_RATE, 0.5925);
});

test("calculates employee wages and both burdens from base payroll", () => {
  const result = calculateInHouseLaborBurden({
    employeeRows: [
      { id: "1", employeeId: "emp-1", employeeName: "Chris", hourlyRate: 25, estimatedHours: 8 },
      { id: "2", employeeId: "emp-2", employeeName: "Ivan", hourlyRate: 30, estimatedHours: 6 },
    ],
  });

  assert.equal(result.basePayroll, 380);
  assert.equal(result.workersCompCost, 190);
  assert.equal(result.payrollTaxCost, 35.15);
  assert.equal(result.payrollBurden, 225.15);
  assert.equal(result.totalLaborCost, 605.15);
  assert.equal(result.workers, 2);
});

test("calculates a loaded hourly wage at 159.25 percent of base wage", () => {
  assert.deepEqual(calculateLoadedHourlyWage(25), {
    baseWage: 25,
    workersCompCost: 12.5,
    payrollTaxCost: 2.31,
    loadedHourlyCost: 39.81,
  });
});

test("keeps the manual crew calculation as a fallback", () => {
  const result = calculateInHouseLaborBurden({ workers: 3, hourlyRate: 20, hoursPerWorker: 8 });
  assert.equal(result.usesEmployeeWages, false);
  assert.equal(result.basePayroll, 480);
  assert.equal(result.totalLaborCost, 764.4);
});
