import { PAYROLL_TAX_RATE, WORKERS_COMP_RATE } from "./laborBurden.js";

export const SPRAY_FOAM_GALLONS_PER_KIT = 110;
export const SPRAY_FOAM_KIT_COST = 2600;
export const APPROVED_JOB_OPERATING_OVERHEAD_RATE = 0.15;

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currencyValue(value) {
  return Math.round((numberValue(value) + Number.EPSILON) * 100) / 100;
}

export function calculateDailyEmployeeLaborCost(employee = {}) {
  const hoursWorked = Math.max(0, numberValue(employee.hoursWorked));
  const hourlyRate = Math.max(0, numberValue(employee.hourlyRate));
  const basePayroll = currencyValue(hoursWorked * hourlyRate);
  const workersCompCost = currencyValue(basePayroll * WORKERS_COMP_RATE);
  const payrollTaxCost = currencyValue(basePayroll * PAYROLL_TAX_RATE);
  return {
    hoursWorked,
    hourlyRate,
    basePayroll,
    workersCompCost,
    payrollTaxCost,
    totalLaborCost: currencyValue(basePayroll + workersCompCost + payrollTaxCost),
  };
}

export function calculateSubcontractorCost(subcontractor = {}) {
  const squares = Math.max(0, numberValue(subcontractor.squares));
  const pricePerSquare = Math.max(0, numberValue(subcontractor.pricePerSquare));
  return {
    squares,
    pricePerSquare,
    totalCost: currencyValue(squares * pricePerSquare),
  };
}

export function calculateSprayFoamMaterialUsage(gallonsUsed) {
  const normalizedGallonsUsed = Math.max(0, numberValue(gallonsUsed));
  const equivalentKits = normalizedGallonsUsed / SPRAY_FOAM_GALLONS_PER_KIT;

  return {
    gallonsUsed: normalizedGallonsUsed,
    equivalentKits,
    totalCost: currencyValue(equivalentKits * SPRAY_FOAM_KIT_COST),
  };
}

export function calculateApprovedJobOperatingOverhead(directCost) {
  const normalizedDirectCost = Math.max(0, numberValue(directCost));
  const operatingOverheadCost = currencyValue(
    normalizedDirectCost * APPROVED_JOB_OPERATING_OVERHEAD_RATE,
  );

  return {
    directCost: currencyValue(normalizedDirectCost),
    operatingOverheadCost,
    totalCost: currencyValue(normalizedDirectCost + operatingOverheadCost),
  };
}

export function calculateApprovedJobFinancialSummary(
  approvedSalePrice,
  changeOrders,
  totalCost,
) {
  const normalizedApprovedSalePrice = Math.max(0, numberValue(approvedSalePrice));
  const normalizedChangeOrders = numberValue(changeOrders);
  const normalizedTotalCost = Math.max(0, numberValue(totalCost));
  const totalSalePrice = currencyValue(
    normalizedApprovedSalePrice + normalizedChangeOrders,
  );
  const profitAmount = currencyValue(totalSalePrice - normalizedTotalCost);
  const profitMarginPercent = totalSalePrice > 0
    ? Math.round(((profitAmount / totalSalePrice) * 100 + Number.EPSILON) * 10) / 10
    : 0;

  return {
    approvedSalePrice: currencyValue(normalizedApprovedSalePrice),
    changeOrders: currencyValue(normalizedChangeOrders),
    totalSalePrice,
    totalCost: currencyValue(normalizedTotalCost),
    profitAmount,
    profitMarginPercent,
  };
}

export function summarizeApprovedDailyProgress(day = {}) {
  const employees = Array.isArray(day.employeeRows) ? day.employeeRows : [];
  const materials = Array.isArray(day.materialsUsed) ? day.materialsUsed : [];
  const subcontractors = Array.isArray(day.subcontractors) ? day.subcontractors : [];
  const laborCosts = employees.map(calculateDailyEmployeeLaborCost);
  const subcontractorCosts = subcontractors.map(calculateSubcontractorCost);
  const sprayFoamUsage = calculateSprayFoamMaterialUsage(day.sprayFoamGallonsUsed);
  const otherMaterialCost = materials.reduce(
    (total, material) => total + numberValue(material.quantity) * numberValue(material.unitCost),
    0,
  );

  return {
    laborHours: laborCosts.reduce((total, labor) => total + labor.hoursWorked, 0),
    basePayroll: currencyValue(laborCosts.reduce((total, labor) => total + labor.basePayroll, 0)),
    workersCompCost: currencyValue(laborCosts.reduce((total, labor) => total + labor.workersCompCost, 0)),
    payrollTaxCost: currencyValue(laborCosts.reduce((total, labor) => total + labor.payrollTaxCost, 0)),
    laborCost: currencyValue(laborCosts.reduce((total, labor) => total + labor.totalLaborCost, 0)),
    subcontractorCost: currencyValue(subcontractorCosts.reduce((total, subcontractor) => total + subcontractor.totalCost, 0)),
    sprayFoamGallonsUsed: sprayFoamUsage.gallonsUsed,
    sprayFoamEquivalentKits: sprayFoamUsage.equivalentKits,
    sprayFoamCost: sprayFoamUsage.totalCost,
    materialCost: currencyValue(otherMaterialCost + sprayFoamUsage.totalCost),
  };
}

export function toggleCollapsedDailyProgressDay(collapsedDayIds = [], dayId) {
  const next = new Set(collapsedDayIds);
  if (next.has(dayId)) next.delete(dayId);
  else next.add(dayId);
  return [...next];
}

export function getDailyProgressDayIds(days = []) {
  return days.map((day) => day.id).filter(Boolean);
}
