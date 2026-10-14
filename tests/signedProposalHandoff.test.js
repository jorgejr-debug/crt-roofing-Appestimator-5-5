import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const office='00000000-0000-0000-0000-000000000001', miguel='00000000-0000-0000-0000-000000000002', other='00000000-0000-0000-0000-000000000003';
const sql=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
async function setup(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;
 GRANT USAGE ON SCHEMA auth,storage TO authenticated;
 CREATE TABLE user_profiles(id uuid PRIMARY KEY,email text,role text);
 INSERT INTO user_profiles VALUES('${office}','daniela@crtroofing.com','salesperson'),('${miguel}','miguel@crtroofing.com','project_manager'),('${other}','other@example.invalid','employee');
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT SELECT,INSERT ON storage.objects TO authenticated;
 GRANT SELECT ON user_profiles TO authenticated;
 CREATE TABLE active_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_record_uid text UNIQUE,workflow_status text,project_name text,job_name text);
 INSERT INTO active_jobs(source_record_uid,workflow_status) VALUES('job:legacy','approved');
 `);
 const queue=sql('20260925120000_active_job_issue_workflow.sql');
 await db.exec(queue.slice(queue.indexOf('CREATE TABLE public.workflow_notifications'),queue.indexOf('GRANT UPDATE(read_at)')+'GRANT UPDATE(read_at) ON public.workflow_notifications TO authenticated;'.length));
 await db.exec(sql('20261007120000_job_approval_notifications.sql'));
 await db.exec(sql('20261007140000_signed_proposal_handoff.sql'));
 return db;
}
async function as(db,id){await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('test.uid','${id}',false)`);}
async function upload(db,source='job:new'){
 await as(db,office);
 const path=`${office}/${crypto.randomUUID()}/signed.pdf`;
 await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('signed-proposals',$1)",[path]);
 return (await db.query('SELECT register_signed_proposal($1,$2,$3,true) AS id',[source,path,'signed.pdf'])).rows[0].id;
}
test('new approvals require uploaded confirmed document; private handoff link and Miguel acknowledgment persist',async()=>{
 const db=await setup();try{
 await assert.rejects(db.exec("INSERT INTO active_jobs(source_record_uid,workflow_status) VALUES('job:new','approved')"),/Upload and confirm/);
 await db.exec("UPDATE active_jobs SET project_name='Old job edit' WHERE source_record_uid='job:legacy'");
 const id=await upload(db);
 await db.exec('RESET ROLE');
 await db.exec("INSERT INTO active_jobs(source_record_uid,workflow_status,project_name) VALUES('job:new','approved','Roof A')");
 const notifications=(await db.query('SELECT * FROM workflow_notifications')).rows;
 assert.equal(notifications.length,1);assert.equal(notifications[0].user_id,miguel);assert.ok(notifications[0].message.includes(`?signedProposal=${id}`));
 await as(db,office);await assert.rejects(db.query('SELECT acknowledge_signed_proposal($1)',[id]),/Only Miguel/);
 await as(db,miguel);await db.query('SELECT acknowledge_signed_proposal($1)',[id]);
 const first=(await db.query('SELECT * FROM signed_proposal_handoffs')).rows[0];
 await db.query('SELECT acknowledge_signed_proposal($1)',[id]);
 assert.equal((await db.query('SELECT * FROM signed_proposal_handoffs')).rows[0].acknowledged_at.toISOString(),first.acknowledged_at.toISOString());
 await as(db,office);assert.equal((await db.query('SELECT * FROM signed_proposal_handoffs')).rows[0].acknowledged_by,miguel);
 await assert.rejects(db.query("UPDATE signed_proposal_handoffs SET acknowledged_at=null"),/permission denied/);
 await as(db,other);assert.equal((await db.query('SELECT * FROM signed_proposal_handoffs')).rows.length,0);assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0);
 }finally{await db.close();}
});
test('registration rejects fake files, missing confirmation, unauthorized callers; attaching to a legacy job notifies once',async()=>{
 const db=await setup();try{
 await as(db,office);
 await assert.rejects(db.query("SELECT register_signed_proposal('job:test','fake','fake.pdf',true)"),/Upload the signed/);
 await assert.rejects(db.query("SELECT register_signed_proposal('job:test','fake','fake.pdf',false)"),/Confirm the customer/);
 await as(db,miguel);await assert.rejects(db.query("SELECT register_signed_proposal('job:test','fake','fake.pdf',true)"),/Office approval/);
 const id=await upload(db,'job:legacy');
 await db.exec('RESET ROLE');
 assert.equal((await db.query('SELECT * FROM workflow_notifications')).rows.length,1);
 await db.exec("UPDATE active_jobs SET workflow_status='approved' WHERE source_record_uid='job:legacy'");
 assert.equal((await db.query('SELECT * FROM workflow_notifications')).rows.length,1);
 assert.ok(id);
 }finally{await db.close();}
});

test('Daniela can create an approved job only with a signed proposal; other staff cannot use the RPC', async()=>{
 const db=await setup();try{
 await db.exec(`ALTER TABLE active_jobs ADD COLUMN user_key text, ADD COLUMN estimate_id text, ADD COLUMN local_estimate_id text, ADD COLUMN job_number text, ADD COLUMN customer_name text, ADD COLUMN customer text, ADD COLUMN address text, ADD COLUMN job_address text, ADD COLUMN status text, ADD COLUMN contract_amount numeric, ADD COLUMN final_bid numeric, ADD COLUMN start_date date, ADD COLUMN anticipated_start_date date, ADD COLUMN project_contact text, ADD COLUMN risk_level text, ADD COLUMN is_active boolean, ADD COLUMN saved_at timestamptz, ADD COLUMN created_at timestamptz, ADD COLUMN updated_at timestamptz, ADD COLUMN updated_by text, ADD COLUMN job_payload jsonb`);
 await db.exec(sql('20261007141000_staff_signed_proposal_approval.sql'));
 await as(db,office);
 await assert.rejects(db.query("SELECT create_staff_approved_job_with_proposal('Test roof')"),/Upload the signed/);
 await upload(db,'job:estimate-test');
 const {rows}=await db.query("SELECT create_staff_approved_job_with_proposal(p_project_name=>'Roof', p_contract_amount=>12000, p_source=>'job:estimate-test') AS job");
 assert.equal(rows[0].job.workflow_status,'approved');assert.equal(rows[0].job.contract_amount,12000);assert.equal(rows[0].job.source_record_uid,'job:estimate-test');
 await as(db,other);
 await assert.rejects(db.query("SELECT create_staff_approved_job_with_proposal('Unauthorized')"),/permission/);
 }finally{await db.close();}
});

test('approval dialog passes the mapped session identity to the private storage policy', async () => {
 const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
 const mapper = app.slice(app.indexOf('function mapAuthUserFromSession('), app.indexOf('\nfunction createFieldDailyLogId('));
 const mapUser = new Function('getEmployeeDirectoryEntry', 'hasExplicitAppRole', 'normalizeAppRole', 'deriveBootstrapRoleFromEmail', `${mapper}; return mapAuthUserFromSession;`)(() => null, Boolean, value => value, () => 'admin');
 const authUser = mapUser({ id: office, email: 'daniela@crtroofing.com' }, { role: 'salesperson' });
 const binding = app.match(/<SignedProposalUpload\b[^>]*userId=\{([^}]+)\}/)?.[1];
 assert.ok(binding, 'approval dialog must supply the upload identity');
 const userId = new Function('authUser', `return ${binding}`)(authUser);
 assert.equal(userId, office, 'the mapped session stores the authenticated UUID in key');
 const db = await setup();
 try {
  await as(db, office);
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('signed-proposals','undefined/test/signed.pdf')"), /row-level security/);
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('signed-proposals',$1)", [`${other}/test/signed.pdf`]), /row-level security/);
  const path = `${userId}/test/signed.pdf`;
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('signed-proposals',$1)", [path]);
  const result = await db.query("SELECT register_signed_proposal('job:identity-regression',$1,'signed.pdf',true) AS id", [path]);
  assert.ok(result.rows[0].id);
 } finally { await db.close(); }
});
