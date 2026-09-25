import {useCallback,useEffect,useState} from 'react';
import InspectionRequestForm from './InspectionRequestForm.jsx';
import TaskAttachments from './TaskAttachments.jsx';
import {INSPECTION_STATUSES,inspectionClosed,inspectionTiming,inspectionDate,appointmentInput,appointmentIso,readInspectionRows} from './inspectionRequests.js';
import './InspectionRequests.css';

function InspectionDetail({row,profiles,supabase,userId,isOffice,busy,onAction,onBack,onOpenTask,onOpenProposal,taskAccessible}) {
 const [draft,setDraft]=useState({notes:row.notes,findings:row.findings,measurements:row.measurements,appointment_at:appointmentInput(row.appointment_at),assigned_to:row.assigned_to||''});
 const [pending,setPending]=useState(false),[audit,setAudit]=useState([]),[auditError,setAuditError]=useState('');
 const canEdit=!inspectionClosed(row)&&(isOffice||row.assigned_to===userId||row.created_by===userId);
 const canConfirm=isOffice||row.assigned_to===userId;
 useEffect(()=>{let active=true;readInspectionRows(supabase,'inspection_request_audit',q=>q.eq('inspection_request_id',row.id)).then(data=>{if(active)setAudit(data);}).catch(error=>{if(active)setAuditError(error.message);});return()=>{active=false;};},[supabase,row.id,row.version]);
 const change=(field,value)=>setDraft(current=>({...current,[field]:value}));
 const update=(action,status)=>onAction(row,action,{...draft,appointment_at:appointmentIso(draft.appointment_at)},status);
 const person=id=>profiles.find(p=>p.id===id)?.full_name||profiles.find(p=>p.id===id)?.email||'Recorded employee';
 return <section className="panel inspectionDetail"><button className="secondaryButton" type="button" disabled={busy||pending} onClick={onBack}>Back to Inspection Request Center</button>
 <div className="inspectionDetailTitle"><h2>IR-{row.request_number} · {row.contact_name}</h2><span className="inspectionBadge">{INSPECTION_STATUSES[row.status]}</span></div>
 <p>{row.property_address||'Address not supplied'}</p><div className="inspectionActions">{row.phone?<a href={`tel:${row.phone}`}>{row.phone}</a>:null}{row.email?<a href={`mailto:${row.email}`}>{row.email}</a>:null}</div>
 <p>Assigned to {person(row.assigned_to)} · Requested by {person(row.created_by)}</p><p>Best time to call: {row.best_time_to_call||'Not specified'} · {row.urgency} priority</p>
 <p role="status">{inspectionTiming(row)}</p>
 <div className="workHubForm">
 <label><span>Assigned technician</span><select disabled={!isOffice||!canEdit||busy||pending} value={draft.assigned_to} onChange={e=>change('assigned_to',e.target.value)}>{profiles.filter(p=>p.id===row.assigned_to||(['salesperson','estimator','admin','cfo'].includes(p.role))).map(p=><option key={p.id} value={p.id}>{p.full_name||p.email}</option>)}</select></label>
 <label><span>Appointment (your device’s local time)</span><input type="datetime-local" value={draft.appointment_at} disabled={!canEdit||busy||pending} onChange={e=>change('appointment_at',e.target.value)}/></label>
 <label><span>Request / scheduling notes</span><textarea rows="4" value={draft.notes} disabled={!canEdit||busy||pending} onChange={e=>change('notes',e.target.value)}/></label>
 <label><span>Inspection findings / observed scope</span><textarea rows="6" value={draft.findings} disabled={!canEdit||busy||pending} onChange={e=>change('findings',e.target.value)}/></label>
 <label><span>Measurements</span><textarea rows="3" value={draft.measurements} disabled={!canEdit||busy||pending} onChange={e=>change('measurements',e.target.value)} placeholder="Record measured areas, dimensions and units. Do not guess."/></label>
 </div>
 <TaskAttachments supabase={supabase} userId={userId} taskId={row.id} attachmentType="inspection" readOnly={!canEdit||busy} onPendingChange={setPending}/>
 {canEdit?<div className="inspectionActions inspectionDetailActions"><button type="button" className="primaryButton" disabled={busy||pending} onClick={()=>update('save')}>Save Details</button>{['contacted','scheduled','inspected','on_hold','cancelled'].filter(status=>status!==row.status&&(status!=='inspected'||canConfirm)).map(status=><button type="button" className="secondaryButton" key={status} disabled={busy||pending} onClick={()=>{if(status!=='cancelled'||window.confirm('Cancel this inspection request? Its history and files will be retained.'))update('status',status);}}>{status==='inspected'?'Confirm Inspected':INSPECTION_STATUSES[status]}</button>)}</div>:null}
 {row.status==='inspected'&&canConfirm?<div className="inspectionHandoff"><p>Create a proposal request for Daniela with these findings, measurements, customer details and attached files. Her review happens before the estimating deadline starts.</p><button type="button" className="primaryButton" disabled={busy||pending} onClick={()=>update('proposal')}>Create Proposal Request for Daniela</button></div>:null}
 {row.proposal_request_id?<button type="button" className="primaryButton" onClick={()=>onOpenProposal(row.proposal_request_id)}>Open Proposal Request</button>:null}
 {taskAccessible?<button type="button" className="secondaryButton" onClick={()=>onOpenTask(row.task_id)}>Open Linked Task Discussion</button>:null}
 <details className="inspectionHistory"><summary>Request history ({audit.length})</summary>{auditError?<p role="alert">History could not load: {auditError}</p>:null}{audit.map(event=><article key={event.id}><strong>{event.action.replaceAll('_',' ')}</strong><p>{person(event.actor_id)} · {inspectionDate(event.created_at)}</p>{event.details?.after?.status?<p>{event.details.before?.status?`${INSPECTION_STATUSES[event.details.before.status]} → `:''}{INSPECTION_STATUSES[event.details.after.status]}</p>:null}{event.details?.file_name?<p>{event.details.file_name}</p>:null}{event.details?.after?<details><summary>Recorded changes</summary><dl>{Object.entries({contact_name:'Contact',phone:'Phone',email:'Email',property_address:'Address',assigned_to:'Technician',appointment_at:'Appointment',notes:'Notes',findings:'Findings',measurements:'Measurements'}).filter(([field])=>event.details.before?.[field]!==event.details.after[field]).map(([field,label])=><div key={field}><dt>{label}</dt><dd>{field==='assigned_to'?person(event.details.after[field]):field==='appointment_at'?inspectionDate(event.details.after[field]):event.details.after[field]||'Cleared'}</dd></div>)}</dl></details>:null}</article>)}</details>
 </section>;
}
export default function InspectionRequests({supabase,authUser,profiles=[],createKey=0,tasks=[],onOpenTask,onOpenProposal}) {
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [view,setView]=useState(createKey?'form':'queue'),[selectedId,setSelectedId]=useState(''),[formRequest,setFormRequest]=useState(null),[busy,setBusy]=useState(false);
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('active');
 const isOffice=['admin','cfo'].includes(authUser.role);
 const load=useCallback(async()=>{setLoading(true);try{setRows(await readInspectionRows(supabase,'inspection_requests'));setError('');}catch(error){setError(`Inspection requests could not load: ${error.message}`);}finally{setLoading(false);}},[supabase]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
 useEffect(()=>{if(!createKey)return;const timer=setTimeout(()=>{setFormRequest(null);setView('form');},0);return()=>clearTimeout(timer);},[createKey]);
 const upsert=row=>setRows(current=>[row,...current.filter(item=>item.id!==row.id)]);
 const selected=rows.find(row=>row.id===selectedId);
 const open=row=>{setError('');setNotice('');if(row.status==='draft'){setFormRequest(row);setView('form');}else{setSelectedId(row.id);setView('detail');}};
 const action=async(row,kind,payload,status)=>{
  if(busy)return;setBusy(true);setError('');setNotice('');let saved=row;
  try{
   const result=await supabase.rpc('save_inspection_request',{p_id:row.id,p_payload:payload,p_expected_version:row.version});if(result.error)throw result.error;saved=Array.isArray(result.data)?result.data[0]:result.data;
   if(kind!=='save'){const result=await supabase.rpc(kind==='proposal'?'create_inspection_proposal_request':'transition_inspection_request',{p_id:row.id,p_expected_version:saved.version,...(kind==='status'?{p_status:status}:{})});if(result.error)throw result.error;saved=Array.isArray(result.data)?result.data[0]:result.data;}
   setNotice(kind==='proposal'?'Proposal request sent to Daniela for review with the inspection files.':'Inspection request updated.');
  }catch(error){setError(error.message||'Could not confirm the update. Reload before retrying.');}finally{upsert(saved);setBusy(false);}
 };
 const visible=rows.filter(row=>(filter==='all'||(filter==='active'?!inspectionClosed(row)&&row.status!=='draft':row.status===filter))&&[row.contact_name,row.property_address,row.phone,`IR-${row.request_number}`].join(' ').toLowerCase().includes(search.toLowerCase()));
 const legacy=tasks.filter(task=>/^Inspection Request:/i.test(task.title||'')&&!rows.some(row=>row.task_id===task.id));
 return <div className="inspectionCenter"><header className="inspectionCenterHeader"><div><p className="eyebrow">Inspection workflow</p><h2>Inspection Request Center</h2><p>{isOffice?'Office overview of submitted inspections. Other employees’ drafts stay private.':'Your submitted and assigned inspections, plus your private drafts.'}</p></div>{view==='queue'?<button type="button" className="primaryButton" onClick={()=>{setFormRequest(null);setView('form');}}>New Inspection Request</button>:null}</header>
 {error?<p className="notice" role="alert">{error}</p>:null}{notice?<p className="notice" role="status">{notice}</p>:null}
 {view==='queue'?<><div className="inspectionFilters"><label><span>Search inspections</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Customer, address or request number"/></label><label><span>Status</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">Active</option><option value="all">All requests</option>{Object.entries(INSPECTION_STATUSES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button type="button" className="secondaryButton" disabled={loading} onClick={()=>void load()}>Refresh</button></div>
 {loading?<p role="status">Loading inspections…</p>:null}<div className="inspectionQueue">{visible.map(row=><button type="button" className="inspectionCard" key={row.id} onClick={()=>open(row)}><span>IR-{row.request_number} · {INSPECTION_STATUSES[row.status]}</span><strong>{row.contact_name||'Untitled draft'}</strong><span>{row.property_address||'Address not supplied'}</span><small>Assigned: {profiles.find(p=>p.id===row.assigned_to)?.full_name||'Not assigned'} · Appointment: {inspectionDate(row.appointment_at)}</small>{inspectionTiming(row)?<b>{inspectionTiming(row)}</b>:null}</button>)}</div>{!loading&&!visible.length?<p>No inspections match this view. Select Draft to see saved requests that have not been submitted.</p>:null}
 {legacy.length?<details className="panel"><summary>Earlier inspection tasks ({legacy.length})</summary><p>These existing tasks retain their original history. Open a task to review its discussion and attachments.</p>{legacy.map(task=><button type="button" className="secondaryButton" key={task.id} onClick={()=>onOpenTask(task.id)}>{task.title}</button>)}</details>:null}</>:null}
 {view==='form'?<InspectionRequestForm key={formRequest?.id||'new'} supabase={supabase} userId={authUser.key} profiles={profiles} initialRequest={formRequest} onSaved={upsert} onSubmitted={row=>{upsert(row);setSelectedId(row.id);setView('detail');setNotice('Inspection request submitted with its saved attachments. The assigned technician has a task and email notification.');}} onCancel={()=>{setView('queue');void load();}}/>:null}
 {view==='detail'&&selected?<InspectionDetail key={`${selected.id}:${selected.version}`} row={selected} profiles={profiles} supabase={supabase} userId={authUser.key} isOffice={isOffice} busy={busy} onAction={action} onBack={()=>setView('queue')} onOpenTask={onOpenTask} onOpenProposal={onOpenProposal} taskAccessible={tasks.some(task=>task.id===selected.task_id)}/>:null}
 </div>;
}
