import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const crew='00000000-0000-0000-0000-000000000001', other='00000000-0000-0000-0000-000000000002', admin='00000000-0000-0000-0000-000000000003', cfo='00000000-0000-0000-0000-000000000004';
test('office can read submitted crew logs and referenced photos, but not drafts, unrelated photos or writes',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated,anon;
 CREATE TABLE user_profiles(id uuid PRIMARY KEY,role text);
 INSERT INTO user_profiles VALUES('${crew}','project_manager'),('${other}','sales'),('${admin}','admin'),('${cfo}','cfo');
 CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid,name text,bucket_id text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;
 GRANT USAGE ON SCHEMA storage TO authenticated; GRANT SELECT,INSERT,UPDATE ON storage.objects TO authenticated;`);
 for(const name of ['20260925122000_field_daily_log_storage.sql','20260925130000_field_log_office_review.sql']) await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 const photo=`${crew}/submitted/progress.jpg`,receipt=`${crew}/submitted/receipt.jpg`,draftPhoto=`${crew}/draft/private.jpg`,orphan=`${crew}/orphan.jpg`,unrelated=`${other}/private.jpg`;
 await db.query(`INSERT INTO field_daily_logs(id,user_key,work_date,status,log_payload) VALUES
 ('submitted',$1,'2026-09-25','submitted',$2),('draft',$1,'2026-09-25','draft',$3)`,[crew,JSON.stringify({photos:[{storagePath:photo},{storagePath:unrelated}],fuelReceipts:[{receiptPhotoPath:receipt}]}),JSON.stringify({photos:[{storagePath:draftPhoto}]})]);
 for(const path of [photo,receipt,draftPhoto,orphan,unrelated]) await db.query("INSERT INTO storage.objects(name,bucket_id) VALUES($1,'field-daily-log-photos')",[path]);
 await db.query("INSERT INTO storage.objects(name,bucket_id) VALUES($1,'unrelated-bucket')",[photo]);
 await db.exec('SET ROLE authenticated');
 for(const office of [admin,cfo]) {
   await db.query("SELECT set_config('test.uid',$1,false)",[office]);
   assert.deepEqual((await db.query('SELECT id FROM field_daily_logs')).rows.map(r=>r.id),['submitted']);
   assert.deepEqual((await db.query('SELECT name FROM storage.objects ORDER BY name')).rows.map(r=>r.name),[photo,receipt].sort());
   assert.equal((await db.query("UPDATE storage.objects SET name='changed' RETURNING *")).rows.length,0);
   await assert.rejects(db.query("UPDATE field_daily_logs SET status='draft'"),/permission denied/);
   await assert.rejects(db.query('SELECT * FROM save_field_daily_log($1::jsonb)',[JSON.stringify({id:'submitted',status:'submitted',workDate:'2026-09-25'})]),/another employee/);
 }
 await db.query("SELECT set_config('test.uid',$1,false)",[other]);
 assert.equal((await db.query('SELECT * FROM field_daily_logs')).rows.length,0);
 assert.deepEqual((await db.query('SELECT name FROM storage.objects')).rows.map(r=>r.name),[unrelated]);
 await db.query("SELECT set_config('test.uid',$1,false)",[crew]);
 assert.equal((await db.query('SELECT * FROM field_daily_logs')).rows.length,2,'owner retains draft and submission');
 await db.exec('RESET ROLE');
 await db.query("UPDATE user_profiles SET role='sales' WHERE id=$1",[admin]);
 await db.exec('SET ROLE authenticated'); await db.query("SELECT set_config('test.uid',$1,false)",[admin]);
 assert.equal((await db.query('SELECT * FROM field_daily_logs')).rows.length,0,'role removal revokes office access');
 await db.exec('RESET ROLE; SET ROLE anon');
 await assert.rejects(db.query('SELECT can_review_submitted_field_logs()'),/permission denied/);
 } finally {await db.close();}
});
