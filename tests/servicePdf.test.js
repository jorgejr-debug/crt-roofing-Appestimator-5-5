import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { jsPDF } from 'jspdf';
import { calculateServiceEstimate } from '../src/serviceEstimate.js';
const source=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('async function generateEstimatePDF('),source.indexOf('\nfunction buildMissingScopeChecklist'));
for(const type of ['Coating','Repair / Service','Maintenance']) test(`${type} exports a real paginated PDF with scope, materials and calculated totals`,async()=>{
 let blob;
 const sandbox={loadJsPdf:async()=>jsPDF,num:(value,digits=1)=>Number(value||0).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}),console,URL:{createObjectURL:value=>{blob=value;return 'blob:local-test';},revokeObjectURL:()=>{}},window:{},setTimeout:()=>{},alert:message=>{throw new Error(message);}};
 vm.createContext(sandbox);vm.runInContext(fn+'\nglobalThis.exportPdf=generateEstimatePDF;',sandbox);
 const inputs={jobName:'Local PDF test',customerName:'Test customer',serviceScope:'Service scope verification. '.repeat(120),serviceMaterials:[{description:'Coating test product',unit:'pail',quantity:3,unitCost:20}],serviceWorkers:2,serviceHourlyRate:25,serviceHoursPerWorker:8,fieldSquares:5};
 const bid=(cost,sq,pct)=>({options:[],selectedBidAmount:cost*1.3,selectedMarkupPercent:pct,selectedPricePerSq:cost*1.3/sq,selectedProfitDollars:cost*.3});
 const calculation=calculateServiceEstimate(inputs,{totalTravelCost:0},bid,17.5);
 assert.equal(await sandbox.exportPdf(inputs,calculation,{},'Local PDF test',type,{closed:false,location:{}}),true);
 assert.ok(blob && blob.size>1000);const text=await blob.text();
 assert.match(text,/%PDF-/);assert.ok(text.includes(type));assert.match(text,/Service scope verification/);assert.match(text,/Coating test product/);assert.match(text,/1,064.67/);assert.ok((text.match(/\/Type \/Page\b/g)||[]).length>=2);
});
