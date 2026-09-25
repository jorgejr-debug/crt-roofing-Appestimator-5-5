import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import ServiceEstimateWorkspace from '../src/ServiceEstimateWorkspace.jsx';
import {calculateServiceEstimate} from '../src/serviceEstimate.js';
import {css,Field,Section,TravelCalculator,OverheadCalculator,calculateTravelAndOvertime,calculateBidOptions,DEFAULT_INPUTS,money2} from '../src/.mobilePreviewSupport.jsx';
import IssueModalPreview from '../src/.mobileIssuePreview.jsx';
import {ACTIVE_JOB_ISSUE_CATEGORIES,ACTIVE_JOB_ISSUE_PRIORITIES,ACTIVE_JOB_ISSUE_STATUSES} from '../src/.mobilePreviewSupport.jsx';
import '../src/WorkflowMobile.css';
import '../src/index.css';
function Preview(){
 const [issueOpen,setIssueOpen]=useState(true);
 const [issueDraft,setIssueDraft]=useState({id:'test-issue',projectId:'local-test',projectName:'Local test job',jobNumber:'TEST',dateTime:'2026-09-25T12:00',callerName:'Test caller',callerCompany:'',phone:'',email:'',issueCategory:'Other',priority:'Critical',currentStatus:'In progress',assignedEmployeeId:'test',assignedEmployeeName:'Test owner',followUpDeadline:'2026-09-25T13:00',description:'LOCAL TEST — water intrusion requires a response.',reason:'',expectedUpdatedAt:'2026-09-25T12:00:00Z'});
 const [response,setResponse]=useState('The office will review this issue.');
 const [template,setTemplate]=useState('coating');
 const [inputs,setInputs]=useState({...DEFAULT_INPUTS,jobName:'LOCAL TEST — roof service',customerName:'Test customer',serviceScope:'Test coating scope. Prepare and coat the specified roof area.',fieldSquares:5,serviceMaterials:[{id:'test',description:'Test material',unit:'pail',quantity:3,unitCost:20}],serviceWorkers:2,serviceHourlyRate:25,serviceHoursPerWorker:8});
 const [message,setMessage]=useState('No database connected');
 const [checks,setChecks]=useState('');
 const setField=(key,value)=>setInputs(current=>({...current,[key]:value}));
 const calculation=calculateServiceEstimate(inputs,calculateTravelAndOvertime(inputs),calculateBidOptions,17.5);
 useEffect(()=>{const check=()=>setChecks(`Width ${innerWidth}px; horizontal overflow: ${document.documentElement.scrollWidth>innerWidth?'YES':'no'}`);const timer=setTimeout(check,500);addEventListener('resize',check);return()=>{clearTimeout(timer);removeEventListener('resize',check);};},[inputs,template]);
 if(new URLSearchParams(location.search).get('mode')==='issue') return <div><style>{css}</style><p>{message}</p><button onClick={()=>setIssueOpen(true)}>Open test issue</button><IssueModalPreview workspace={{activeJobIssueModalOpen:issueOpen,activeJobs:[{id:'local-test',projectName:'Local test job',jobNumber:'TEST'}],activeJobIssueDraft:issueDraft,activeJobSelectedId:'local-test',employeeDirectory:[{id:'test',displayName:'Test owner',isActive:true}],closeActiveJobIssueModal:()=>setIssueOpen(false),activeJobIssueSaving:false,saveActiveJobIssue:()=>setMessage('Local test: issue save callback reached'),Field,setActiveJobIssueDraft:setIssueDraft,ACTIVE_JOB_ISSUE_CATEGORIES,ACTIVE_JOB_ISSUE_PRIORITIES,ACTIVE_JOB_ISSUE_STATUSES,activeJobIssueResponse:response,setActiveJobIssueResponse:setResponse,buildActiveJobSuggestedResponse:()=> 'Test suggested response',activeJobIssueHistory:[],activeJobIssueHistoryError:''}} /></div>;
 return <main className="portalMain" style={{margin:0,padding:0}}><div style={{padding:12}}><strong>{checks}</strong><p role="status">{message}</p><label>Template <select value={template} onChange={e=>setTemplate(e.target.value)}><option value="coating">Coating</option><option value="repair">Repair / Service</option><option value="maintenance">Maintenance</option></select></label></div><ServiceEstimateWorkspace template={template} workspace={{inputs,setInputs,setField,calculation,css,Field,Section,TravelCalculator,OverheadCalculator,money2,renderEstimatorShellHeader:({title,intro})=><header><h1>{title}</h1><p>{intro}</p></header>,setTravelField:setField,setTravelVehicleSelection:()=>{},addTravelVehicleSelection:()=>{},removeTravelVehicleSelection:()=>{},handleCalculateDistance:()=>setMessage('Local test: distance lookup callback'),handleSaveEstimate:()=>setMessage('Local test: save callback reached'),handleConvertCurrentEstimateToProposal:()=>setMessage('Local test: proposal callback reached'),handleDownloadEstimatePDF:()=>setMessage('Local test: PDF callback reached')}} /></main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
