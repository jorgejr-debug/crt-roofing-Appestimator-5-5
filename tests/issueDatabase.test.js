import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const admin='00000000-0000-0000-0000-000000000001';
const natalia='00000000-0000-0000-0000-000000000002';
const worker='00000000-0000-0000-0000-000000000003';
const manager='00000000-0000-0000-0000-000000000004';
const setup = async () => {
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TABLE user_profiles(id uuid PRIMARY KEY,email text,role text,full_name text);
 CREATE TABLE employees(id text PRIMARY KEY,is_active boolean,email text,display_name text,employee_name text,first_name text,last_name text);
 CREATE TABLE active_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_record_uid text UNIQUE,workflow_status text,job_payload jsonb,project_name text,job_name text,risk_level text,updated_at timestamptz,updated_by text);
 INSERT INTO user_profiles VALUES ('${admin}','jorgejr@crtroofing.com','admin','Jorge'),('${natalia}','natalia@crtroofing.com','cfo','Natalia'),('${worker}','test-worker@example.invalid','employee','Worker'),('${manager}','test-manager@example.invalid','project_manager','Manager');
 INSERT INTO employees VALUES ('employee-1',true,'test-worker@example.invalid','Worker',null,null,null);
 INSERT INTO active_jobs(source_record_uid,workflow_status,job_payload,risk_level) VALUES ('job:test','active','{"issues":[{"id":"legacy","description":"Historical issue","status":"New","createdAt":"2026-01-01"}],"contractAmount":123,"activityLog":[]}','Normal');
 GRANT SELECT ON user_profiles TO authenticated;
 `);
 for(const name of ['20260925120000_active_job_issue_workflow.sql','20260925121000_workflow_delivery_queue.sql']) await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${admin}',false);`);
 return db;
};
const issue = (extra={}) => ({id:'new-issue',description:'Test issue',priority:'Normal',status:'New',assignedEmployeeId:'employee-1',followUpDeadline:'2099-01-01T12:00:00Z',...extra});
const save=(db,data,request=crypto.randomUUID(),expected=null)=>db.query('SELECT * FROM save_active_job_issue($1,$2::jsonb,$3::uuid,$4)', ['job:test',JSON.stringify(data),request,expected]);
test('migration preserves historical records; locked issue save is audited and idempotent',async()=>{
 const db=await setup();try{
 const request=crypto.randomUUID();
 const {rows}=await save(db,issue(),request);
 const result=rows[0].job_payload;
 assert.equal(result.contractAmount,123);assert.deepEqual(result.issues[0],{id:'legacy',description:'Historical issue',status:'New',createdAt:'2026-01-01'});
 await save(db,issue(),request);
 await assert.rejects(save(db,issue({description:"Changed after uncertain save"}),request),/previous save was confirmed/);
 assert.equal((await db.query('SELECT * FROM job_issue_audit')).rows.length,1);
 await assert.rejects(db.query("UPDATE workflow_notifications SET email_status='sent'"),/permission denied/);
 assert.equal((await db.query('SELECT * FROM workflow_notifications')).rows.length,1,'RLS exposes only own notification');
 await db.exec('RESET ROLE');
 assert.equal((await db.query('SELECT * FROM workflow_notifications')).rows.length,3);
 const snapshot=result.issues;
 await db.query(`UPDATE active_jobs SET job_payload='{"issues":[],"contractAmount":456}' WHERE source_record_uid='job:test'`);
 assert.deepEqual((await db.query('SELECT job_payload FROM active_jobs')).rows[0].job_payload.issues,snapshot);
 }finally{await db.close();}
});
test('validation and access checks reject invalid owner, missing deadline and unauthorized actor',async()=>{
 const db=await setup();try{
 await assert.rejects(save(db,issue({assignedEmployeeId:''})),/active employee/);
 await assert.rejects(save(db,issue({followUpDeadline:''})),/deadline/);
 await db.exec(`SELECT set_config('test.uid','${worker}',false)`);
 await assert.rejects(save(db,issue()),/access required/);
 await assert.rejects(db.query(`INSERT INTO job_issue_audit(request_id,source_record_uid,issue_id,actor_id,action,after_issue) VALUES(gen_random_uuid(),'job:test','x','${worker}','forged','{}')`),/permission denied/);
 assert.equal((await db.query('SELECT * FROM job_issue_audit')).rows.length,0);
 }finally{await db.close();}
});
test('critical deadline is capped; resolution requires confirmation; stale updates cannot overwrite history',async()=>{
 const db=await setup();try{
 await db.exec(`SELECT set_config('test.uid','${manager}',false)`);
 const created=(await save(db,issue({priority:'Critical'}))).rows[0].job_payload.issues.at(-1);
 assert.ok(Date.parse(created.followUpDeadline)-Date.now()<3601000);
 await assert.rejects(save(db,issue({status:'Resolved'}),crypto.randomUUID(),created.updatedAt),/Confirm resolution/);
 const resolved=(await save(db,issue({status:'Resolved',resolutionNote:'Correction verified',resolutionConfirmed:true}),crypto.randomUUID(),created.updatedAt)).rows[0].job_payload.issues.at(-1);
 assert.equal(resolved.resolvedBy,manager);assert.ok(resolved.resolvedAt);
 await assert.rejects(save(db,issue(),crypto.randomUUID(),created.updatedAt),/issue changed/);
 const reopened=(await save(db,issue(),crypto.randomUUID(),resolved.updatedAt)).rows[0].job_payload.issues.at(-1);
 assert.equal(reopened.resolvedAt,null);
 assert.deepEqual((await db.query('SELECT action FROM job_issue_audit ORDER BY created_at')).rows.map(x=>x.action),['reported','resolved','reopened']);
 }finally{await db.close();}
});
test('delivery claims are server-only and leased to prevent duplicate concurrent delivery',async()=>{
 const db=await setup();try{
 await save(db,issue());await assert.rejects(db.query('SELECT * FROM claim_workflow_notifications()'),/permission denied/);
 await db.exec('RESET ROLE; SET ROLE service_role');
 const first=(await db.query('SELECT * FROM claim_workflow_notifications()')).rows;
 assert.equal(first.length,3);assert.ok(first.every(x=>x.attempts===1 && x.email_status==='sending'));
 assert.equal((await db.query('SELECT * FROM claim_workflow_notifications()')).rows.length,0);
 }finally{await db.close();}
});
