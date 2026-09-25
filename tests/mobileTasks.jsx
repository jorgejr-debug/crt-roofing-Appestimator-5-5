import React from 'react';
import {createRoot} from 'react-dom/client';
import WorkHub from '../src/WorkHub.jsx';
import {css} from '../src/.mobilePreviewSupport.jsx';
const rows={company_tasks:[],user_profiles:[{id:'test-user',full_name:'Local inspector',role:'estimator',is_active:true}],company_task_attachments:[],inspection_requests:[],inspection_request_attachments:[],inspection_request_audit:[],proposal_requests:[]};
let offlineUpload=true;
const stamp=()=>new Date().toISOString();
const api={
 from(table){const filters=[];let single=false;const q={then:resolve=>{const result=(rows[table]||[]).filter(row=>filters.every(([field,value])=>row[field]===value));resolve({data:single?result[0]||null:result,error:null});}};for(const method of ['select','order','or','limit','is','update','range'])q[method]=()=>q;q.eq=(field,value)=>{filters.push([field,value]);return q;};q.maybeSingle=()=>{single=true;return q;};return q;},
 channel(){const q={on:()=>q,subscribe:()=>q};return q;},removeChannel(){},
 storage:{from(){return {upload:async()=>{if(offlineUpload){offlineUpload=false;return{error:new Error('Simulated weak connection')}}return {error:null};},createSignedUrl:async()=>({data:{signedUrl:'about:blank'}})};}},
 async rpc(name,args){
  if(name==='register_inspection_attachment'){const row={id:args.p_id,inspection_request_id:args.p_inspection_request_id,file_name:args.p_file_name,storage_path:args.p_storage_path,created_at:stamp()};rows.inspection_request_attachments=[row];return{data:row};}
  const old=rows.inspection_requests.find(row=>row.id===args.p_id);let saved;
  if(name==='save_inspection_request')saved={id:args.p_id,request_number:1,created_by:'test-user',status:'draft',notes:'',findings:'',measurements:'',created_at:stamp(),...old,...args.p_payload,assigned_to:args.p_payload.assigned_to||'test-user',version:(old?.version||0)+1};
  else if(name==='submit_inspection_request')saved={...old,status:'new',submitted_at:stamp(),version:old.version+1};
  else if(name==='transition_inspection_request')saved={...old,status:args.p_status,version:old.version+1};
  else if(name==='create_inspection_proposal_request'){saved={...old,status:'proposal_requested',proposal_request_id:'local-proposal',version:old.version+1};rows.proposal_requests=[{id:'local-proposal',request_number:1,created_by:'test-user',salesperson_id:'test-user',customer_name:old.contact_name,property_name:old.contact_name,service_address:old.property_address,scope_of_work:old.findings,measurements:old.measurements,status:'draft',draft_handoff_status:'awaiting_review',created_at:stamp()}];}
  else throw new Error(`Unexpected local fixture operation: ${name}`);
  rows.inspection_requests=[saved];rows.inspection_request_audit.push({id:crypto.randomUUID(),inspection_request_id:saved.id,actor_id:'test-user',action:name,details:{before:old,after:saved},created_at:stamp()});return{data:saved};
 }
};
createRoot(document.getElementById('root')).render(<><style>{css}</style><p>ISOLATED TEST — no live database or emails. First upload simulates a lost connection.</p><WorkHub supabase={api} authUser={{key:'test-user',role:'estimator'}} initialTab="inspections" onSubmitInspection={()=>{}} /></>);
