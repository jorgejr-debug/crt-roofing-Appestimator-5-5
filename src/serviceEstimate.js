import { calculateInHouseLaborBurden } from './laborBurden.js';
export const SERVICE_TEMPLATES = ['coating', 'repair', 'maintenance'];
const amount = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export function calculateServiceEstimate(inputs, travelAndOvertime, calculateBidOptions, overheadPercent) {
  const materialRows = (inputs.serviceMaterials || []).map(row => ({ ...row, total: amount(row.quantity) * amount(row.unitCost) }));
  const materialCost = materialRows.reduce((sum, row) => sum + row.total, 0);
  const labor = calculateInHouseLaborBurden({ workers: amount(inputs.serviceWorkers), hourlyRate: amount(inputs.serviceHourlyRate), hoursPerWorker: amount(inputs.serviceHoursPerWorker) });
  const travelCost = amount(travelAndOvertime.totalTravelCost);
  const directJobCost = materialCost + labor.totalLaborCost + travelCost + amount(inputs.scopeAdders) + amount(inputs.miscCost);
  const overheadOperatingCost = directJobCost * amount(inputs.overheadPercent ?? overheadPercent) / 100;
  const totalCostBeforeProfit = directJobCost + overheadOperatingCost;
  const totalSquares = amount(inputs.fieldSquares);
  const bidOptions = calculateBidOptions(totalCostBeforeProfit, totalSquares, amount(inputs.selectedMarkupPercent) || 30);
  return { scope: { totalSquares }, materialRows, materialCost, materialPricingCost: materialCost, totalDetailMaterialCost: 0, labor, laborCost: labor.totalLaborCost, travelAndOvertime, travelCost, totalTravelCost: travelCost, directJobCost, overheadCost: overheadOperatingCost, operatingCost: 0, overheadOperatingCost, totalCostBeforeProfit, totalCost: totalCostBeforeProfit, bidOptions, ...Object.fromEntries(Object.entries(bidOptions).filter(([key]) => key !== 'options')), totalJobCost: bidOptions.selectedBidAmount };
}
export function validateServiceEstimate(inputs) {
  if (!String(inputs.jobName || '').trim() || !String(inputs.customerName || '').trim()) return 'Enter a job name and customer.';
  if (!String(inputs.serviceScope || inputs.maintenanceNotes || '').trim()) return 'Describe the service scope before saving or creating a proposal.';
  const values = [inputs.serviceWorkers, inputs.serviceHourlyRate, inputs.serviceHoursPerWorker, inputs.fieldSquares, inputs.scopeAdders, inputs.miscCost, inputs.overheadPercent, ...(inputs.serviceMaterials || []).flatMap(row => [row.quantity, row.unitCost])];
  if (values.some(value => value != null && (!Number.isFinite(Number(value)) || Number(value) < 0))) return 'Costs, quantities, and labor must be valid nonnegative numbers.';
  if ((inputs.serviceMaterials || []).some(row => !String(row.description || '').trim())) return 'Describe each material line.';
  return '';
}
