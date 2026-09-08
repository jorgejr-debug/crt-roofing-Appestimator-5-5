import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateApprovedJobFinancialSummary,
  calculateApprovedJobOperatingOverhead,
  calculateDailyEmployeeLaborCost,
  calculateSprayFoamMaterialUsage,
  calculateSubcontractorCost,
  getDailyProgressDayIds,
  summarizeApprovedDailyProgress,
  toggleCollapsedDailyProgressDay,
} from "./approvedDailyProgress.js";

test("adds change orders to sale price and calculates profit margin", () => {
  assert.deepEqual(calculateApprovedJobFinancialSummary(100000, 5000, 80500), {
    approvedSalePrice: 100000,
    changeOrders: 5000,
    totalSalePrice: 105000,
    totalCost: 80500,
    profitAmount: 24500,
    profitMarginPercent: 23.3,
  });
});

test("adds 15 percent operating and overhead cost to approved job totals", () => {
  assert.deepEqual(calculateApprovedJobOperatingOverhead(1000), {
    directCost: 1000,
    operatingOverheadCost: 150,
    totalCost: 1150,
  });
});

test("calculates daily employee payroll with workers comp and payroll tax", () => {
  assert.deepEqual(calculateDailyEmployeeLaborCost({ hoursWorked: 8, hourlyRate: 25 }), {
    hoursWorked: 8,
    hourlyRate: 25,
    basePayroll: 200,
    workersCompCost: 100,
    payrollTaxCost: 18.5,
    totalLaborCost: 318.5,
  });
});

test("summarizes a daily progress card for its minimized view", () => {
  const summary = summarizeApprovedDailyProgress({
    employeeRows: [
      { hoursWorked: 8, hourlyRate: 25 },
      { hoursWorked: "4.5", hourlyRate: "30" },
    ],
    materialsUsed: [
      { quantity: 3, unitCost: 12.5 },
      { quantity: "2", unitCost: "10" },
    ],
  });

  assert.deepEqual(summary, {
    laborHours: 12.5,
    basePayroll: 335,
    workersCompCost: 167.5,
    payrollTaxCost: 30.99,
    laborCost: 533.49,
    subcontractorCost: 0,
    sprayFoamGallonsUsed: 0,
    sprayFoamEquivalentKits: 0,
    sprayFoamCost: 0,
    materialCost: 57.5,
  });
});

test("calculates subcontractor squares times price per square", () => {
  assert.deepEqual(calculateSubcontractorCost({ squares: 42.5, pricePerSquare: 115 }), {
    squares: 42.5,
    pricePerSquare: 115,
    totalCost: 4887.5,
  });
  const summary = summarizeApprovedDailyProgress({
    subcontractors: [
      { squares: 10, pricePerSquare: 100 },
      { squares: 5.5, pricePerSquare: 80 },
    ],
  });
  assert.equal(summary.subcontractorCost, 1440);
});

test("calculates proportional spray foam kit usage and cost from gallons", () => {
  assert.deepEqual(calculateSprayFoamMaterialUsage(55), {
    gallonsUsed: 55,
    equivalentKits: 0.5,
    totalCost: 1300,
  });
  assert.deepEqual(calculateSprayFoamMaterialUsage(220), {
    gallonsUsed: 220,
    equivalentKits: 2,
    totalCost: 5200,
  });
});

test("includes spray foam cost in the daily material total", () => {
  const summary = summarizeApprovedDailyProgress({
    sprayFoamGallonsUsed: 110,
    materialsUsed: [{ quantity: 2, unitCost: 25 }],
  });

  assert.equal(summary.sprayFoamEquivalentKits, 1);
  assert.equal(summary.sprayFoamCost, 2600);
  assert.equal(summary.materialCost, 2650);
});

test("toggles one minimized day without changing the others", () => {
  assert.deepEqual(toggleCollapsedDailyProgressDay(["day-1"], "day-2"), ["day-1", "day-2"]);
  assert.deepEqual(toggleCollapsedDailyProgressDay(["day-1", "day-2"], "day-1"), ["day-2"]);
});

test("collects saved day ids so existing days can open minimized", () => {
  assert.deepEqual(getDailyProgressDayIds([{ id: "day-1" }, {}, { id: "day-3" }]), ["day-1", "day-3"]);
});
