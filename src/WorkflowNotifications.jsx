import { useCallback, useEffect, useState } from 'react';
export default function WorkflowNotifications({ supabase, userId }) {
  const [items,setItems]=useState([]), [error,setError]=useState(''), [busy,setBusy]=useState('');
  const refresh=useCallback(async()=>{
    const {data,error}=await supabase.from('workflow_notifications').select('id,kind,message,created_at,read_at,email_status').eq('user_id',userId).is('read_at',null).order('created_at',{ascending:false}).limit(50);
    setError(error ? `Alerts could not load: ${error.message}` : '');
    if(!error)setItems(data || []);
  },[supabase,userId]);
  useEffect(()=>{if(!userId)return;const initial=setTimeout(()=>void refresh(),0);const timer=setInterval(()=>void refresh(),60000);return()=>{clearTimeout(initial);clearInterval(timer);};},[refresh,userId]);
  const acknowledge=async id=>{
    if(busy)return;setBusy(id);
    try {const {error}=await supabase.from('workflow_notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId);if(error)throw error;setItems(current=>current.filter(item=>item.id!==id));}
    catch(error){setError(`Alert was not acknowledged: ${error.message}`);}finally{setBusy('');}
  };
  return <details className="workflowAlerts"><summary>Workflow alerts ({items.length}{items.length===50?'+':''})</summary>
    {error?<p role="alert">{error}</p>:null}<button type="button" className="secondaryButton" onClick={()=>void refresh()}>Refresh alerts</button>
    {!items.length&&!error?<p>No unread alerts.</p>:null}
    {items.map(item=><article key={item.id}><strong>{item.kind.replaceAll('_',' ')}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()} · Email: {item.email_status}</small><button type="button" className="secondaryButton" disabled={Boolean(busy)} onClick={()=>void acknowledge(item.id)}>Acknowledge alert</button></article>)}
  </details>;
}
