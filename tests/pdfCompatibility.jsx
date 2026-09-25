import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {calculateServiceEstimate} from '../src/serviceEstimate.js';
import {createProposalRequestPdf} from '../src/proposalRequestExport.js';
import {generateEstimatePDF,generateProposalPDF,createProposalFromEstimate,loadPdfReader,calculateBidOptions,DEFAULT_INPUTS} from '../src/.mobilePreviewSupport.jsx';
function Compatibility(){
 const [results,setResults]=useState([]),[busy,setBusy]=useState(false);
 const add=text=>setResults(old=>[...old,text]);
 async function readPdf(bytes,label,expected){
   add('Reading '+label);
   const reader=await loadPdfReader();
   const task=reader.getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
   const pdf=await task.promise;
   let text='';
   for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);text+=(await page.getTextContent()).items.map(i=>i.str).join(' ');}
   if(!text.includes(expected))throw new Error(label+': expected content missing');
   const page=await pdf.getPage(1),viewport=page.getViewport({scale:.8}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
   await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   document.getElementById('previews').appendChild(canvas);
   add(`PASS ${label}: ${pdf.numPages} pages, expected text found, first page rendered`);await task.destroy();
 }
 async function run(){setBusy(true);setResults([]);document.getElementById('previews').replaceChildren();
 try{
 for(const type of ['Coating','Repair / Service','Maintenance']){
   const inputs={...DEFAULT_INPUTS,jobName:'LOCAL TEST ONLY',customerName:'Local fixture',serviceScope:'Local compatibility scope. '.repeat(90),serviceMaterials:[{description:'Local test material',unit:'pail',quantity:3,unitCost:20}],serviceWorkers:2,serviceHourlyRate:25,serviceHoursPerWorker:8,fieldSquares:5};
   const calculation=calculateServiceEstimate(inputs,{totalTravelCost:0},calculateBidOptions,17.5);
   const preview={closed:false,location:{}};
   // Exercise the browser preview fallback without prompting to save a local fixture.
   window.showSaveFilePicker=undefined;
   add('Generating '+type);
   if(!await generateEstimatePDF(inputs,calculation,{},'Local fixture',type,preview))throw new Error(type+' generation failed');
   await readPdf(await (await fetch(preview.location.href)).arrayBuffer(),type+' estimate','Local test material');
   const estimate={id:'local-only',estimateType:type,estimateCode:'LOCAL-ONLY',name:'Local fixture',inputs,summary:{roofType:type,selectedBidAmount:calculation.selectedBidAmount}};
   const proposal=createProposalFromEstimate(estimate);
   const output=await generateProposalPDF(proposal,estimate);
   await readPdf(await (await fetch(output.pdfDataUrl)).arrayBuffer(),type+' proposal','Local compatibility scope');
 }
 await readPdf(createProposalRequestPdf({request:{request_number:1,property_name:'Local request fixture'},fieldGroups:[]}), 'Proposal request','Local request fixture');
 add('COMPLETE: no production database connected, no business records written');
 }catch(error){add('FAIL '+error.message);}finally{setBusy(false);}}
 return <main><h1>Isolated PDF compatibility checks</h1><p>Real export and PDF reader code; local synthetic fixtures only.</p><button disabled={busy} onClick={run}>Run PDF checks</button><ul>{results.map((r,i)=><li key={i}>{r}</li>)}</ul><div id="previews" style={{display:'flex',flexWrap:'wrap',gap:10}}/></main>;
}
createRoot(document.getElementById('root')).render(<Compatibility/>);
