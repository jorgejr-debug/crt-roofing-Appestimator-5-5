import React from 'react';
import {createRoot} from 'react-dom/client';
import WorkHub from '../src/WorkHub.jsx';
import {css} from '../src/.mobilePreviewSupport.jsx';
const task={id:'test-task',created_by:'test-user',title:'Isolated task attachment check',status:'open',priority:'normal'};
const rows={company_tasks:[task],user_profiles:[{id:'test-user',full_name:'Local test user',role:'estimator'}],company_task_attachments:[]};
let offlineUpload=true;
const api={
 from(table){const q={then:resolve=>resolve({data:rows[table]||[],error:null})}; for(const method of ['select','order','eq','or','limit','is','update'])q[method]=()=>q;return q;},
 channel(){const q={on:()=>q,subscribe:()=>q};return q;}, removeChannel(){},
 storage:{from(){return {upload:async()=>{if(offlineUpload){offlineUpload=false;return{error:new Error('Simulated weak connection')}}return {error:null};},createSignedUrl:async()=>({data:{signedUrl:'about:blank'}})};}},
 async rpc(name,args){if(name==='register_task_attachment'){const row={id:args.p_id,task_id:args.p_task_id,file_name:args.p_file_name,storage_path:args.p_storage_path};rows.company_task_attachments=[row];return {data:row};}throw new Error('Unexpected local fixture operation');}
};
createRoot(document.getElementById('root')).render(<><style>{css}</style><p>ISOLATED TEST — no live database or emails. First upload simulates a lost connection.</p><WorkHub supabase={api} authUser={{key:'test-user',role:'estimator'}} onSubmitInspection={async lead=>{rows.company_tasks=[{...task,title:`Inspection Request: ${lead.contactName}`}];return task;}} /></>);
