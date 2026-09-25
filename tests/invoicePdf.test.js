import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { jsPDF } from 'jspdf';
test('invoice PDF retains billing identity and item totals with the patched PDF library',async()=>{
 const source=fs.readFileSync(new URL('../src/InvoiceQueue.jsx',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('function buildInvoicePdf('),source.indexOf('\nexport default function InvoiceQueue'));
 const context={jsPDF,money:n=>Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD'}),lineTotal:items=>items.reduce((sum,item)=>sum+item.quantity*item.unit_price,0)};
 vm.createContext(context);vm.runInContext(fn+'\nglobalThis.build=buildInvoicePdf;',context);
 const blob=context.build({customer_name:'LOCAL TEST ONLY',project_name:'Isolated invoice',billing_contact_name:'Local fixture'}, {invoiceNumber:'LOCAL-TEST',dueDate:'2026-09-25',paymentTerms:'Local fixture',notes:'Not a business invoice',lineItems:[{description:'Local labor',quantity:2,unit_price:50},{description:'Local material',quantity:3,unit_price:20}]});
 const text=await blob.text();assert.match(text,/%PDF/);assert.match(text,/LOCAL-TEST/);assert.match(text,/Local labor/);assert.match(text,/160\.00/);
});
