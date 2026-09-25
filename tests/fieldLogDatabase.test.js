import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
test('daily logs save atomically, reject stale edits, isolate owners and lock submitted history',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$; GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TABLE user_profiles(id uuid PRIMARY KEY); INSERT INTO user_profiles VALUES('${owner}'),('${other}');
 CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid,name text,bucket_id text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20260925122000_field_daily_log_storage.sql',import.meta.url),'utf8'));
 await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${owner}',false)`);
 const save=async(log,version=null)=>(await db.query('SELECT * FROM save_field_daily_log($1::jsonb,$2::timestamptz)',[JSON.stringify(log),version])).rows[0];
 const draft={id:'field-test',status:'draft',jobNumber:'J-TEST',workDate:'2026-09-25',workCompleted:'Inspection',crewRows:[{id:'crew',regularHours:8}],photos:[]};
 const first=await save(draft);assert.deepEqual(first.log_payload.crewRows,draft.crewRows);
 assert.equal((await save(draft)).updated_at.getTime(),first.updated_at.getTime(),'uncertain save can retry');
 await assert.rejects(save({...draft,workCompleted:'Changed'}),/another device/);
 await db.exec(`SELECT set_config('test.uid','${other}',false)`);
 assert.equal((await db.query('SELECT * FROM field_daily_logs')).rows.length,0);
 await assert.rejects(save(draft),/another employee/);
 await db.exec(`SELECT set_config('test.uid','${owner}',false)`);
 await assert.rejects(save({...draft,status:'submitted'},first.updated_at.toISOString()),/photo/);
 const submitted={...draft,status:'submitted',photos:[{photoCategory:'progress',storagePath:`${owner}/field-test/progress/image.jpg`}]};
 const completed=await save(submitted,first.updated_at.toISOString());
 assert.equal(completed.status,'submitted');
 await assert.rejects(save({...submitted,workCompleted:'Overwrite'},completed.updated_at.toISOString()),/locked/);
 await assert.rejects(db.query("UPDATE field_daily_logs SET status='draft'"),/permission denied/);
 const correction={...submitted,id:'correction',correctionOfLogId:draft.id,correctionReason:'Correct crew hours'};
 await save(correction);
 assert.equal((await db.query('SELECT count(*) FROM field_daily_logs')).rows[0].count,2);
 }finally{await db.close();}
});
