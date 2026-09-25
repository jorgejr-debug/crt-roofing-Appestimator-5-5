import test from 'node:test';
import assert from 'node:assert/strict';
import {collectWorkflowAlerts,notificationRecipients} from '../supabase/functions/_shared/workflow-alerts.js';
const now=new Date('2026-09-26T02:00:00Z'); // Friday 7pm Los Angeles, not Saturday.
const base={id:'job',source_record_uid:'job:test',workflow_status:'active',status:'Scheduled',job_number:'J-1',project_name:'Test job',start_date:'2026-09-26',job_payload:{issues:[]}};
test('starts and missing logs use company-local dates and skip archived jobs',()=>{
 const alerts=collectWorkflowAlerts({jobs:[base,{...base,source_record_uid:'job:old',workflow_status:'archived'}]},now);
 assert.deepEqual(alerts.map(x=>x.kind),['start_approaching']);assert.match(alerts[0].event_key,/2026-09-25$/);
 const active={...base,status:'Active',start_date:'2026-09-25'};
 assert.deepEqual(collectWorkflowAlerts({jobs:[active]},now).map(x=>x.kind),['daily_log_missing']);
 assert.equal(collectWorkflowAlerts({jobs:[active],logs:[{job_number:'J-1',status:'submitted',work_date:'2026-09-25'}]},now).length,0);
 assert.equal(collectWorkflowAlerts({jobs:[active]},new Date('2026-09-27T02:00:00Z')).length,0);
});
test('issue reminders stop on resolution and have stable daily deduplication keys',()=>{
 const row={...base,job_payload:{issues:[{id:'one',status:'New',followUpDeadline:'2026-09-24T12:00:00Z',assignedEmployeeId:'e'},{id:'two',status:'Resolved',priority:'Critical'},{id:'three',status:'New',priority:'High'}]}};
 const a=collectWorkflowAlerts({jobs:[row]},now);assert.deepEqual(a.map(x=>x.kind),['issue_overdue','serious_issue','start_approaching']);
 assert.deepEqual(a,collectWorkflowAlerts({jobs:[row]},new Date(now.getTime()+1000)));
});
test('cost and day alerts require a matching real estimate and compare distinct logged days',()=>{
 const job={...base,status:'Active',estimate_id:'local-1',job_payload:{actualCost:150,dailyProgressLog:[{date:'2026-09-23'},{date:'2026-09-24'},{date:'2026-09-24'}]}};
 const estimates=[{id:'db-1',local_estimate_id:'local-1',estimate_data:{inputs:{numberOfJobDays:1},summary:{totalCostBeforeProfit:100}}}];
 const result=collectWorkflowAlerts({jobs:[job],estimates},now);
 assert.deepEqual(result.map(x=>x.kind),['days_exceeded','cost_exceeded']);
 assert.equal(collectWorkflowAlerts({jobs:[job]},now).length,0);
});
test('proposals, invoices and AR exclude paid, paused and closed records',()=>{
 const result=collectWorkflowAlerts({proposals:[{id:'p',status:'submitted',target_completion_at:'2026-09-24T00:00:00Z'},{id:'closed',status:'closed',updated_at:'2026-01-01'},{id:'paused',status:'missing_information',sla_paused_at:'2026-09-23',target_completion_at:'2026-09-24'}],invoices:[{id:'i',status:'Sent',due_date:'2026-09-24'},{id:'paid',status:'Paid',due_date:'2026-09-24'}],receivables:[{id:'r',amount:1,period_to_date:'2026-09-24',status:'Overdue'},{id:'period-only',amount:1,period_to_date:'2026-01-01',status:'Waiting on Payment'},{id:'r2',amount:1,period_to_date:'2026-09-24',status:'Paid'}]},now);
 assert.deepEqual(result.map(x=>x.kind),['proposal_waiting','invoice_overdue','receivable_overdue']);
});
test('financial alerts stay with finance; issue ownership routes only via existing linked profiles',()=>{
 const profiles=[{id:'j',email:'jorgejr@crtroofing.com',role:'admin'},{id:'n',email:'natalia@crtroofing.com',role:'cfo'},{id:'m',email:'manager@example.invalid',role:'project_manager'},{id:'w',email:'worker@example.invalid',role:'employee'}];
 assert.deepEqual(notificationRecipients({audience:'finance'},profiles),['j','n']);
 assert.deepEqual(notificationRecipients({audience:'issue',recipients:[{employeeId:'e'}]},profiles,[{id:'e',email:'worker@example.invalid'}]),['j','n','w']);
 assert.deepEqual(notificationRecipients({audience:'operations'},profiles),['j','n','m']);
});

test('unavailable daily logs suppress false missing-log alerts without blocking other reminders',()=>{
 const active={...base,status:'Active',start_date:'2026-09-25',job_payload:{issues:[{id:'late',status:'New',followUpDeadline:'2026-09-24T12:00:00Z'}]}};
 assert.deepEqual(collectWorkflowAlerts({jobs:[active]},now,{dailyLogsAvailable:false}).map(x=>x.kind),['issue_overdue']);
});

test('existing saved job progress satisfies the daily-log check after rollout',()=>{
 const active={...base,status:'Active',start_date:'2026-09-25',daily_progress_log:[{date:'2026-09-25'}]};
 assert.equal(collectWorkflowAlerts({jobs:[active]},now).length,0);
});

test('sales follow-up starts exactly 72 hours after sending and routes only to the assigned salesperson',()=>{
 const proposal={id:'p1',request_number:42,status:'sent',sent_at:'2026-09-23T02:00:00Z',salesperson_id:'ivan',customer_name:'Test customer',target_completion_at:'2026-09-01'};
 assert.equal(collectWorkflowAlerts({proposals:[proposal]},new Date('2026-09-26T01:59:59Z')).length,0);
 const alerts=collectWorkflowAlerts({proposals:[proposal]},now);
 assert.equal(alerts.length,1);assert.equal(alerts[0].kind,'sales_follow_up');
 assert.deepEqual(notificationRecipients(alerts[0],[{id:'ivan',role:'estimator'},{id:'j',email:'jorgejr@crtroofing.com',role:'cfo'},{id:'n',email:'natalia@crtroofing.com'}]),['ivan']);
 assert.equal(collectWorkflowAlerts({proposals:[proposal]},new Date(now.getTime()+60000))[0].event_key,alerts[0].event_key);
 assert.notEqual(collectWorkflowAlerts({proposals:[proposal]},new Date(now.getTime()+86400000))[0].event_key,alerts[0].event_key);
 for(const status of ['signed','declined','closed','draft']) assert.equal(collectWorkflowAlerts({proposals:[{...proposal,status}]},now).length,0);
 for(const sent_at of [null,'','invalid']) assert.equal(collectWorkflowAlerts({proposals:[{...proposal,sent_at}]},now).length,0);
 assert.equal(collectWorkflowAlerts({proposals:[{...proposal,salesperson_id:null}]},now).length,0);
});
