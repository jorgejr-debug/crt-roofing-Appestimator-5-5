import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
export const creator='10000000-0000-0000-0000-000000000001',ivan='10000000-0000-0000-0000-000000000002',office='10000000-0000-0000-0000-000000000003',daniela='10000000-0000-0000-0000-000000000004',outsider='10000000-0000-0000-0000-000000000005',request='10000000-0000-0000-0000-000000000006',file='10000000-0000-0000-0000-000000000007';

export async function createInspectionDatabase() {
 const db=new PGlite();
 try {
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,banned_until timestamptz);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('test.uid',true),''))::uuid$$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT current_user::text$$;
 CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;
 GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon,service_role;GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;
 CREATE TABLE user_profiles(id uuid PRIMARY KEY,full_name text,email text,role text);
 INSERT INTO user_profiles VALUES('${creator}','Caller','caller@example.invalid','salesperson'),('${ivan}','Ivan','ivan@crtroofing.com','salesperson'),('${office}','Office','office@example.invalid','cfo'),('${daniela}','Daniela','daniela@crtroofing.com','estimator'),('${outsider}','Other','other@example.invalid','salesperson');
 CREATE TABLE company_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_by uuid,title text,description text,priority text,due_date date,created_at timestamptz DEFAULT now());
 GRANT SELECT ON company_tasks TO authenticated;
 CREATE TABLE company_task_assignees(task_id uuid,user_id uuid,assigned_at timestamptz DEFAULT now());
 CREATE TABLE crm_leads(id uuid PRIMARY KEY,created_by uuid,originator_id uuid,originator_name text,originator_email text,relationship_owner_id uuid,assigned_staff_id text,contact_name text,company_name text DEFAULT '',first_name text DEFAULT '',last_name text DEFAULT '',phone text,email text,property_address text,lead_source text,service_needed text,quick_note text,status text,qualification_status text,qualified_at timestamptz,qualified_by uuid,accepted_for_inspection_at timestamptz,accepted_for_inspection_by uuid,updated_by uuid);
 CREATE FUNCTION can_access_company_task(uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM company_tasks WHERE id=$1 AND (created_by=auth.uid() OR EXISTS(SELECT 1 FROM company_task_assignees WHERE task_id=$1 AND user_id=auth.uid())))$$;
 CREATE FUNCTION can_use_crm() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id=auth.uid())$$;
 CREATE FUNCTION is_proposal_manager() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT auth.uid()='${office}'::uuid$$;
 CREATE FUNCTION create_private_company_task(text,text,date,text,uuid[]) RETURNS company_tasks LANGUAGE plpgsql SECURITY DEFINER AS $$DECLARE t company_tasks;BEGIN
 INSERT INTO company_tasks(created_by,title,description,due_date,priority) VALUES(auth.uid(),$1,$2,$3,$4) RETURNING * INTO t;
 INSERT INTO company_task_assignees SELECT t.id,unnest($5);RETURN t;END$$;
 CREATE TABLE proposal_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_by uuid,salesperson_id uuid,customer_name text,property_name text,service_address text,project_contact_phone text,project_contact_email text,existing_lead_job_id text,scope_of_work text,measurements text,salesperson_notes text,priority text,status text DEFAULT 'draft',draft_handoff_status text DEFAULT 'none');
 CREATE FUNCTION can_access_proposal_request(uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM proposal_requests WHERE id=$1 AND (created_by=auth.uid() OR salesperson_id=auth.uid() OR auth.uid() IN ('${office}'::uuid,'${daniela}'::uuid)))$$;
 CREATE FUNCTION write_proposal_audit(uuid,text,text DEFAULT '') RETURNS void LANGUAGE sql AS $$SELECT NULL::void$$;
 CREATE FUNCTION submit_draft_proposal_handoff(uuid,boolean) RETURNS proposal_requests LANGUAGE plpgsql AS $$DECLARE r proposal_requests;BEGIN UPDATE proposal_requests SET draft_handoff_status='awaiting_review' WHERE id=$1 RETURNING * INTO r;RETURN r;END$$;
 CREATE TABLE workflow_notifications(event_key text,user_id uuid,source_record_uid text,kind text,message text,UNIQUE(event_key,user_id));`);
 await db.exec(`ALTER TABLE proposal_requests ADD COLUMN task_id uuid, ADD COLUMN request_number bigint GENERATED BY DEFAULT AS IDENTITY,
 ADD COLUMN work_type text,ADD COLUMN customer_deadline date,ADD COLUMN assigned_estimator_id uuid,ADD COLUMN intake_mode text,
 ADD COLUMN draft_handoff_submitted_at timestamptz,ADD COLUMN missing_information_notes text,ADD COLUMN target_completion_at timestamptz,ADD COLUMN accepted_at timestamptz,ADD COLUMN updated_at timestamptz;
 ALTER TABLE company_tasks ADD COLUMN status text,ADD COLUMN related_type text,ADD COLUMN related_id text,ADD COLUMN related_label text,ADD COLUMN task_type text;
 ALTER TABLE company_task_assignees ADD COLUMN assigned_by uuid,ADD CONSTRAINT assignees_unique UNIQUE(task_id,user_id);
 CREATE TABLE proposal_test_notifications(request_id uuid,user_id uuid,kind text,message text);
 CREATE FUNCTION queue_proposal_notification(uuid,uuid,text,text) RETURNS void LANGUAGE sql AS $$INSERT INTO proposal_test_notifications VALUES($1,$2,$3,$4)$$;`);
 const actualHandoff=readFileSync(new URL('../supabase/migrations/20260922100000_draft_proposal_handoff.sql',import.meta.url),'utf8');
 await db.exec(actualHandoff.slice(actualHandoff.indexOf('CREATE OR REPLACE FUNCTION public.submit_draft_proposal_handoff'),actualHandoff.indexOf('CREATE OR REPLACE FUNCTION public.review_draft_proposal_handoff')));
 await db.exec(readFileSync(new URL('../supabase/migrations/20260925150000_mobile_task_requests_and_attachments.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20260925160000_inspection_request_center.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20260925161000_inspection_profile_compatibility.sql',import.meta.url),'utf8'));

 const taskRpc=readFileSync(new URL('../supabase/migrations/20260824211500_fix_private_company_task_creation.sql',import.meta.url),'utf8');
 await db.exec(taskRpc.slice(taskRpc.indexOf('CREATE OR REPLACE FUNCTION public.create_private_company_task'),taskRpc.indexOf('ALTER FUNCTION public.create_private_company_task')));
 const crm=readFileSync(new URL('../supabase/migrations/20260918100000_shared_crm_leads_and_kpi_targets.sql',import.meta.url),'utf8');
 await db.exec(crm.slice(crm.indexOf('CREATE OR REPLACE FUNCTION public.can_use_crm'),crm.indexOf('CREATE TABLE IF NOT EXISTS public.crm_leads')));
 await db.exec('CREATE TABLE company_task_comments(id uuid PRIMARY KEY,task_id uuid,author_id uuid,body text)');
 await db.exec(readFileSync(new URL('../supabase_task_notifications.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20260828203000_task_comment_email_notifications.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20260929120000_retell_phone_intake.sql',import.meta.url),'utf8'));

 return db;
 } catch(error) {await db.close();throw error;}
}
