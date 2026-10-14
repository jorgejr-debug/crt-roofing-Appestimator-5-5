import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInspectionDatabase, daniela, ivan, outsider } from './inspectionDatabaseFixture.js';
import { analyzedCall } from './retellFixture.js';
import { selectRetellCall } from '../supabase/functions/retell-webhook/handler.js';

const actor='20000000-0000-0000-0000-000000000001';
const natalia='20000000-0000-0000-0000-000000000002';
test('message routing uses private tasks, atomic receipts and existing notifications', async () => {
 const db=await createInspectionDatabase();
 const intake=async (id,fields={})=>(await db.query('SELECT * FROM process_retell_call($1)',[selectRetellCall(analyzedCall(id,{call_type:'General Inquiry',message_route:'General Message',...fields}))])).rows[0];
 try {
  await db.query("INSERT INTO auth.users VALUES($1,now()+interval '100 years');",[actor]);
  await db.query("INSERT INTO user_profiles VALUES($1,'AI Phone','ai-phone@automation.crtroofing.invalid','salesperson'),($2,'Natalia','natalia@crtroofing.com','admin')",[actor,natalia]);
  await db.query("INSERT INTO phone_intake_identity(provider,user_id) VALUES('retell',$1)",[actor]);
  // Ensure adding message outcomes preserves already processed estimate receipts.
  const estimate=await intake('estimate',{call_type:'New Estimate'});
  await db.exec(readFileSync(new URL('../supabase/migrations/20261002150000_retell_message_routing.sql',import.meta.url),'utf8'));
  assert.equal((await intake('estimate')).inspection_request_id,estimate.inspection_request_id);
  for (const [id,route,recipient,urgency,priority] of [
   ['general','General Message',natalia,'Routine / No Urgent Issue','normal'],
   ['contract','Contract Question',daniela,'Routine / No Urgent Issue','normal'],
   ['service_leak','General Message',natalia,'Active Leak / Water Intrusion','high']]) {
   const e=await intake(id,{message_route:route,urgency_status:urgency});
   assert.equal(e.processing_status,'processed');assert.equal(e.inspection_request_id,null);assert.ok(e.task_id);
   const task=(await db.query('SELECT * FROM company_tasks WHERE id=$1',[e.task_id])).rows[0];
   assert.equal(task.created_by,actor);assert.equal(task.priority,priority);assert.equal(task.due_date,null);
   const a=(await db.query('SELECT * FROM company_task_assignees WHERE task_id=$1',[e.task_id])).rows;
   assert.equal(a.length,1);assert.equal(a[0].user_id,recipient);assert.equal(a[0].assigned_by,actor);
   const notifications=(await db.query('SELECT * FROM company_task_notifications WHERE task_id=$1',[e.task_id])).rows;
   assert.equal(notifications.length,1);assert.equal(notifications[0].user_id,recipient);
   const replay=await intake(id,{message_route:route==='General Message'?'Contract Question':'General Message'});
   assert.equal(replay.task_id,e.task_id);assert.equal(replay.attempts,1);
   assert.equal((await db.query('SELECT auth.uid() AS id')).rows[0].id,null);
  }
  assert.equal((await db.query('SELECT count(*) FROM inspection_requests')).rows[0].count,1);
  assert.equal((await db.query('SELECT count(*) FROM crm_leads')).rows[0].count,1);
  assert.equal((await intake('no_contact',{caller_name:'',callback_number:'',email_address:'',property_address:''})).processing_status,'processed');
  for (const [i,fields] of [{message_route:null},{message_route:'Natalia'},{reason_for_call:''},{callback_number:{}},{reason_for_call:'x'.repeat(31000)}].entries()) {
   const e=await intake('invalid_'+i,fields);assert.equal(e.processing_status,'needs_review');assert.equal(e.task_id,null);
  }
  await db.query("UPDATE user_profiles SET email='away@example.invalid' WHERE id=$1",[natalia]);
  assert.equal((await intake('retry_recipient')).processing_status,'failed');
  await db.query("UPDATE user_profiles SET email='natalia@crtroofing.com' WHERE id=$1",[natalia]);
  assert.equal((await intake('retry_recipient')).processing_status,'processed');
  // Assignment failure must roll back the task and restore automation attribution.
  await db.exec("CREATE FUNCTION fail_message_assignment() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'assignment failure';END$$; CREATE TRIGGER fail_assignment BEFORE INSERT ON company_task_assignees FOR EACH ROW EXECUTE FUNCTION fail_message_assignment();");
  const before=(await db.query('SELECT count(*) FROM company_tasks')).rows[0].count;
  assert.equal((await intake('rollback')).processing_status,'failed');
  assert.equal((await db.query('SELECT count(*) FROM company_tasks')).rows[0].count,before);
  assert.equal((await db.query('SELECT auth.uid() AS id')).rows[0].id,null);
  await db.exec('DROP TRIGGER fail_assignment ON company_task_assignees');
  assert.equal((await intake('rollback')).processing_status,'processed');
  const next=await intake('estimate_after',{call_type:'New Estimate',message_route:null});
  assert.equal((await db.query('SELECT assigned_to FROM inspection_requests WHERE id=$1',[next.inspection_request_id])).rows[0].assigned_to,ivan);
  const contractEstimate=await intake('contract_estimate',{call_type:'New Estimate',message_route:'Contract Question'});
  assert.equal(contractEstimate.inspection_request_id,null);
  assert.equal((await db.query('SELECT user_id FROM company_task_assignees WHERE task_id=$1',[contractEstimate.task_id])).rows[0].user_id,daniela);
  for (const role of ['anon','authenticated','service_role']) {
   await db.exec('SET ROLE '+role);
   await assert.rejects(db.query('SELECT create_retell_message_task($1)',[{}]),/permission denied/);
   if(role!=='service_role') await assert.rejects(db.query('SELECT process_retell_call($1)',[{}]),/permission denied/);
   await db.exec('RESET ROLE');
  }
  await db.query("SELECT set_config('test.uid',$1,false)",[outsider]);
  assert.equal((await db.query("SELECT can_access_company_task(task_id) AS allowed FROM phone_intake_events WHERE external_call_id='general'")).rows[0].allowed,false);
  await db.query("SELECT set_config('test.uid',$1,false)",[natalia]);
  assert.equal((await db.query("SELECT can_access_company_task(task_id) AS allowed FROM phone_intake_events WHERE external_call_id='general'")).rows[0].allowed,true);
 } finally {await db.close();}
});
