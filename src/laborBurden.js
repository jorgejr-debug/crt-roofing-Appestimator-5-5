export const WORKERS_COMP_RATE = 0.5;
export const PAYROLL_TAX_RATE = 0.0925;
export const TOTAL_LABOR_BURDEN_RATE = WORKERS_COMP_RATE + PAYROLL_TAX_RATE;

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function currencyValue(value) {
  return Math.round((numberValue(value) + Number.EPSILON) * 100) / 100;
}

export function normalizeEstimateLaborEmployeeRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row, index) => ({
    id: String(row?.id || `labor-employee-${index + 1}`),
    employeeId: String(row?.employeeId || row?.employee_id || ""),
    employeeName: String(row?.employeeName || row?.employee_name || ""),
    hourlyRate: numberValue(row?.hourlyRate ?? row?.hourly_rate),
    estimatedHours: numberValue(row?.estimatedHours ?? row?.estimated_hours),
  }));
}

export function calculateInHouseLaborBurden({ employeeRows = [], workers = 0, hourlyRate = 0, hoursPerWorker = 0 } = {}) {
  const normalizedRows = normalizeEstimateLaborEmployeeRows(employeeRows);
  const selectedRows = normalizedRows.filter((row) => row.employeeId || row.employeeName);
  const usesEmployeeWages = selectedRows.length > 0;
  const basePayroll = currencyValue(usesEmployeeWages
    ? selectedRows.reduce((total, row) => total + row.hourlyRate * row.estimatedHours, 0)
    : numberValue(workers) * numberValue(hourlyRate) * numberValue(hoursPerWorker));
  const workersCompCost = currencyValue(basePayroll * WORKERS_COMP_RATE);
  const payrollTaxCost = currencyValue(basePayroll * PAYROLL_TAX_RATE);
  const payrollBurden = currencyValue(workersCompCost + payrollTaxCost);

  return {
    employeeRows: normalizedRows,
    usesEmployeeWages,
    workers: usesEmployeeWages ? selectedRows.length : Math.round(numberValue(workers)),
    basePayroll,
    workersCompRate: WORKERS_COMP_RATE,
    workersCompCost,
    payrollTaxRate: PAYROLL_TAX_RATE,
    payrollTaxCost,
    payrollBurdenPercent: TOTAL_LABOR_BURDEN_RATE * 100,
    payrollBurden,
    totalLaborCost: currencyValue(basePayroll + payrollBurden),
  };
}

export function calculateLoadedHourlyWage(hourlyRate) {
  const baseWage = numberValue(hourlyRate);
  return {
    baseWage: currencyValue(baseWage),
    workersCompCost: currencyValue(baseWage * WORKERS_COMP_RATE),
    payrollTaxCost: currencyValue(baseWage * PAYROLL_TAX_RATE),
    loadedHourlyCost: currencyValue(baseWage * (1 + TOTAL_LABOR_BURDEN_RATE)),
  };
}
