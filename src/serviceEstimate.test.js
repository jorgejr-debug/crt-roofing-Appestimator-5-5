import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateServiceEstimate,validateServiceEstimate} from './serviceEstimate.js';
const bid=(cost,squares,markup)=>({options:[{percent:markup,bidAmount:cost*(1+markup/100)}],selectedMarkupPercent:markup,selectedBidAmount:cost*(1+markup/100),selectedPricePerSq:squares?cost*(1+markup/100)/squares:0,selectedProfitDollars:cost*markup/100});
test('service totals reuse loaded labor, shared travel, overhead and markup without double counting',()=>{
 const result=calculateServiceEstimate({serviceMaterials:[{quantity:3,unitCost:20}],serviceWorkers:2,serviceHourlyRate:25,serviceHoursPerWorker:8,scopeAdders:15,miscCost:10,fieldSquares:5,selectedMarkupPercent:30},{totalTravelCost:50},bid,10);
 assert.equal(result.materialCost,60);assert.equal(result.laborCost,637);assert.equal(result.directJobCost,772);assert.equal(result.overheadOperatingCost,77.2);assert.equal(result.totalCostBeforeProfit,849.2);assert.equal(result.selectedBidAmount,849.2*1.3);
});
test('service estimate handles zero area and rejects invalid money or missing scope',()=>{
 const result=calculateServiceEstimate({}, {totalTravelCost:0},bid,10);
 assert.equal(result.selectedPricePerSq,0);assert.equal(result.totalCost,0);
 assert.match(validateServiceEstimate({}),/job name/);
 assert.match(validateServiceEstimate({jobName:'Test',customerName:'Test',serviceScope:'Inspect',serviceMaterials:[{description:'Product',quantity:1,unitCost:-1}]}),/nonnegative/);
 assert.equal(validateServiceEstimate({jobName:'Test',customerName:'Test',maintenanceNotes:'Inspect'}),'');
});
