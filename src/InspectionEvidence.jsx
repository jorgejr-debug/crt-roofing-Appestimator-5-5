import {useEffect,useState} from 'react';
import TaskAttachments from './TaskAttachments.jsx';
export default function InspectionEvidence({supabase,proposalId,userId}) {
 const [record,setRecord]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;supabase.from('inspection_requests').select('id,request_number,notes,findings,measurements').eq('proposal_request_id',proposalId).maybeSingle().then(({data,error})=>{if(active){setRecord(data);setError(error?.message||'');}});return()=>{active=false;};},[supabase,proposalId]);
 if(error)return <p role="alert">Inspection files could not load: {error}</p>;
 if(!record)return null;
 return <section className="panel"><h3>Inspection IR-{record.request_number} · Photos &amp; Files</h3><p>Original inspection attachments carried into this proposal request. Files remain in their private inspection record.</p><TaskAttachments supabase={supabase} userId={userId} taskId={record.id} attachmentType="inspection" readOnly/></section>;
}
