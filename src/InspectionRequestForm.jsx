import { useEffect, useState } from 'react';
import FileDropZone from './FileDropZone.jsx';
import TaskAttachments from './TaskAttachments.jsx';
import { inspectionDraft } from './inspectionRequests.js';
import { TASK_ATTACHMENT_ACCEPT, INSPECTION_FILE_OPTIONS, createTaskUpload, saveTaskAttachment, validateTaskAttachment } from './taskAttachments.js';
export default function InspectionRequestForm({ supabase, userId, initialRequest, profiles = [], onSubmitted, onSaved, onCancel }) {
 const storageKey=`crt.inspection-request.${userId}`;
 const [draft,setDraft]=useState(()=>{if(initialRequest)return inspectionDraft(initialRequest);try{return inspectionDraft(JSON.parse(localStorage.getItem(storageKey)) || {});}catch{return inspectionDraft();}});
 const [files,setFiles]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const pendingFiles = files.length > 0;
 useEffect(()=>{if(!pendingFiles&&!busy)return;const guard=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[pendingFiles,busy]);
 const persist = next => {setDraft(next);try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{setNotice('Device draft storage is unavailable. Save Draft before leaving.');}};
 const change=(field,value)=>persist({...draft,[field]:value});
 const choose=selected=>{const invalid=selected.map(validateTaskAttachment).filter(Boolean);if(invalid.length){setError(invalid.join(' '));return;}setFiles(current=>[...current,...selected.map(file=>createTaskUpload(draft.id,userId,file))]);setError('');};
 const save=async(send=false)=>{
  if(busy)return;if(navigator.onLine===false){setError('You are offline. Keep this screen open to keep selected files, then retry. Text is saved on this device.');return;}
  if(send&&(!draft.contact_name.trim()||![draft.phone,draft.email,draft.property_address].some(value=>value.trim()))){setError('Enter a contact name and phone, email, or property address.');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const {data,error}=await supabase.rpc('save_inspection_request',{p_id:draft.id,p_payload:draft,p_expected_version:draft.version});if(error)throw error;
   let saved=Array.isArray(data)?data[0]:data;persist(inspectionDraft(saved));onSaved?.(saved);
   const failed=[];
   for(const entry of files){try{await saveTaskAttachment(supabase,saved.id,entry,INSPECTION_FILE_OPTIONS);}catch(error){failed.push({...entry,error:error.message});}}
   setFiles(failed);setRevision(value=>value+1);
   if(failed.length){setError('Draft saved, but some attachments failed. Keep this screen open and retry. The request has not been sent.');return;}
   if(send){const result=await supabase.rpc('submit_inspection_request',{p_id:saved.id,p_expected_version:saved.version});if(result.error)throw result.error;saved=Array.isArray(result.data)?result.data[0]:result.data;
    try{localStorage.removeItem(storageKey);}catch{/* Server save is confirmed. */}onSubmitted(saved);
   }else setNotice('Draft and attachments saved. Only you can see them until you submit.');
  }catch(error){setError(`${error.message || 'Request could not be confirmed.'} Your text and selected files are preserved here. Retry, or reload the saved draft if it changed.`);}
  finally{setBusy(false);}
 };
 const reload=async()=>{if(busy)return;setBusy(true);try{const {data,error}=await supabase.from('inspection_requests').select('*').eq('id',draft.id).maybeSingle();if(error)throw error;if(data?.status!=='draft'&&data){onSubmitted(data);return;}if(data){persist(inspectionDraft(data));onSaved?.(data);setError('');setNotice('Saved draft reloaded.');}else setNotice('No server draft yet. Your local text is still here.');}catch(error){setError(error.message);}finally{setBusy(false);}};
 return <section className="panel inspectionRequestPanel"><h2>Submit Inspection Request</h2><p>Add customer details and photos or documents now. Submission sends the complete request to the assigned technician.</p>
 <form className="workHubForm" onSubmit={event=>{event.preventDefault();void save(true);}}>
 <fieldset disabled={busy} className="inspectionRequestFields">
 <label><span>Contact name or company *</span><input autoComplete="name" value={draft.contact_name} onChange={e=>change('contact_name',e.target.value)} required /></label>
 <div className="workHubFormRow"><label><span>Phone</span><input type="tel" value={draft.phone} onChange={e=>change('phone',e.target.value)} /></label><label><span>Email</span><input type="email" value={draft.email} onChange={e=>change('email',e.target.value)} /></label></div>
 <label><span>Property address</span><input autoComplete="street-address" value={draft.property_address} onChange={e=>change('property_address',e.target.value)} /></label>
 <small>Provide at least a phone number, email, or address.</small>
 <label><span>Assigned technician</span><select value={draft.assigned_to} onChange={e=>change('assigned_to',e.target.value)}><option value="">Ivan (default)</option>{profiles.filter(p=>['salesperson','estimator','admin','cfo'].includes(p.role)).map(p=><option key={p.id} value={p.id}>{p.full_name||p.email}</option>)}</select></label>
 <label><span>Best time to call</span><input value={draft.best_time_to_call} onChange={e=>change('best_time_to_call',e.target.value)} /></label>
 <label><span>Urgency</span><select value={draft.urgency} onChange={e=>change('urgency',e.target.value)}><option>Normal</option><option>High</option><option>Urgent</option></select></label>
 <label><span>Inspection notes</span><textarea rows="4" value={draft.notes} onChange={e=>change('notes',e.target.value)} /></label>
 </fieldset>
 <FileDropZone accept={TASK_ATTACHMENT_ACCEPT} label="Attach Photos & Files" help="Select photos, PDFs, Word or Excel files before submitting. Up to 25 MB each." disabled={busy} onFiles={choose}/>
 {files.length?<div>{files.map(entry=><div className="inspectionPendingFile" key={entry.id}><span>{entry.file.name}{entry.error?` — ${entry.error}`:''}</span><button type="button" className="secondaryButton" disabled={busy} onClick={()=>setFiles(current=>current.filter(item=>item.id!==entry.id))}>Remove selected file</button></div>)}<small>Selected files upload when you save or submit. Keep this screen open until they are saved.</small></div>:null}
 {draft.version>0?<TaskAttachments key={`${draft.id}:${revision}`} supabase={supabase} userId={userId} taskId={draft.id} attachmentType="inspection" readOnly/>:null}
 {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
 <div className="inspectionRequestSubmit inspectionActions"><button type="button" className="secondaryButton" disabled={busy} onClick={()=>void save()}>Save Draft & Attachments</button><button type="submit" className="primaryButton" disabled={busy}>{busy?'Saving…':'Submit Inspection Request'}</button></div>
 <button type="button" className="secondaryButton" disabled={busy} onClick={()=>void reload()}>Reload saved draft</button><button type="button" className="secondaryButton" disabled={busy} onClick={()=>{if(!files.length||window.confirm('Selected files are not saved yet. Leave this form and select them again later?'))onCancel();}}>Back to Inspection Request Center</button>
 </form></section>;
}
