import { createClient } from 'npm:@supabase/supabase-js@2';
import { collectWorkflowAlerts, notificationRecipients } from '../_shared/workflow-alerts.js';
const headers = {'Content-Type':'application/json'};
Deno.serve(async request => {
  if(request.method!=='POST') return new Response('{}',{status:405,headers});
  const secret=Deno.env.get('TASK_NOTIFICATION_WEBHOOK_SECRET');
  if(!secret || request.headers.get('x-task-webhook-secret')!==secret) return new Response('{}',{status:401,headers});
  const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey=Deno.env.get('RESEND_API_KEY'), from=Deno.env.get('TASK_NOTIFICATION_FROM_EMAIL');
  if(!url || !key || !apiKey || !from) return new Response(JSON.stringify({error:'Notification service is not configured'}),{status:503,headers});
  const dryRun=(await request.json().catch(()=>({}))).dryRun===true;
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const readAll = async (table:string, select='*', filter?: (query:any)=>any) => {
    const rows:any[]=[];
    for(let offset=0;;offset+=500){
      let query=admin.from(table).select(select).order('id').range(offset,offset+499);
      if(filter) query=filter(query);
      const {data,error}=await query; if(error) throw error;
      rows.push(...data); if(data.length<500) return rows;
      if(offset>=49500) throw new Error(`Notification scan limit reached for ${table}`);
    }
  };
  try {
    const profiles=await readAll('user_profiles','id,email,role');
    const {data:claimed,error}=dryRun ? {data:[],error:null} : await admin.rpc('claim_workflow_notifications'); if(error)throw error;
    let sent=0,failed=0;
    for(const notification of claimed || []){
      let sendError='';
      try {
        const recipient=profiles.find(profile=>profile.id===notification.user_id);
        if(!recipient?.email) throw new Error('Recipient email is missing');
        const response=await fetch('https://api.resend.com/emails',{
          method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`workflow/${notification.id}`},
          body:JSON.stringify({from,to:[recipient.email],subject:`CRT Roofing: ${notification.kind.replaceAll('_',' ')}`,text:`${notification.message}\n\nOpen CRT Roofing: ${Deno.env.get('TASK_NOTIFICATION_APP_URL') || 'https://crt-roofing-estimator.vercel.app/'}`}),
          signal:AbortSignal.timeout(10000),
        });
        if(!response.ok) throw new Error(`Email provider returned ${response.status}`);
      }catch(error){sendError=String(error).slice(0,500);}
      const {error:updateError}=await admin.from('workflow_notifications').update({email_status:sendError?'failed':'sent',email_error:sendError,email_sent_at:sendError?null:new Date().toISOString(),next_attempt_at:new Date(Date.now()+Math.min(60,2**notification.attempts)*60000).toISOString()}).eq('id',notification.id).eq('attempts',notification.attempts).eq('email_status','sending');
      if(updateError) throw updateError;
      if(sendError)failed++;else sent++;
    }
    let queued=0, scanFailed=false;
    const alertsByKind:Record<string,number>={};
    try {
    const scanResults=await Promise.allSettled([
      readAll('active_jobs','*',q=>q.eq('workflow_status','active')),
      readAll('field_daily_logs','id,job_number,work_date,status',q=>q.eq('status','submitted')),
      readAll('estimates','id,local_estimate_id,estimate_code,estimate_data'),
      readAll('proposal_requests'),readAll('invoice_requests'),
      readAll('company_financial_records','id,source_record_uid,customer_name,record_name,amount,status,period_to_date,is_archived',q=>q.eq('record_type','receivable').eq('is_archived',false)),
      readAll('employees','id,email'),
    ]);
    const sources=['active_jobs','field_daily_logs','estimates','proposal_requests','invoice_requests','company_financial_records','employees'];
    const [jobs,logs,estimates,proposals,invoices,receivables,employees]=scanResults.map((result,index)=>{
      if(result.status==='fulfilled') return result.value;
      scanFailed=true;
      console.error(`Workflow source unavailable: ${sources[index]}`,String(result.reason));
      return [];
    });
    const alerts=collectWorkflowAlerts({jobs,logs,estimates,proposals,invoices,receivables},new Date(),{dailyLogsAvailable:scanResults[1].status==='fulfilled'});
    for(const alert of alerts) alertsByKind[alert.kind]=(alertsByKind[alert.kind] || 0)+1;
    const rows=alerts.flatMap(alert=>notificationRecipients(alert,profiles,employees).map(user_id=>({event_key:alert.event_key,user_id,source_record_uid:alert.source_record_uid,kind:alert.kind,message:alert.message})));
    for(let offset=0;!dryRun && offset<rows.length;offset+=200){const {error}=await admin.from('workflow_notifications').upsert(rows.slice(offset,offset+200),{onConflict:'event_key,user_id',ignoreDuplicates:true});if(error)throw error;}
    queued=rows.length;
    } catch(error) { scanFailed=true; console.error('Workflow scan failed',String(error)); }
    return new Response(JSON.stringify({queued,sent,failed,scanFailed,dryRun,alertsByKind}),{status:failed || scanFailed?502:200,headers});
  }catch(error){console.error('Workflow notification processing failed',String(error));return new Response(JSON.stringify({error:'Workflow notification processing failed; check function logs'}),{status:500,headers});}
});
