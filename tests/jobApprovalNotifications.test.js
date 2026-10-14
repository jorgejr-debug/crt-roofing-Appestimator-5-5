import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const migration = readFileSync(new URL('../supabase/migrations/20261007120000_job_approval_notifications.sql', import.meta.url), 'utf8');
const recipient = '00000000-0000-0000-0000-000000000001';
async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE user_profiles(id uuid PRIMARY KEY, email text);
    INSERT INTO user_profiles VALUES ('${recipient}', 'Miguel@crtroofing.com'), (gen_random_uuid(), 'natalia@crtroofing.com');
    CREATE TABLE active_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_record_uid text UNIQUE, workflow_status text, project_name text, job_name text);
    INSERT INTO active_jobs(source_record_uid,workflow_status) VALUES ('historical','approved');`);
  const queue = readFileSync(new URL('../supabase/migrations/20260925120000_active_job_issue_workflow.sql', import.meta.url), 'utf8');
  await db.exec(queue.slice(queue.indexOf('CREATE TABLE public.workflow_notifications'), queue.indexOf('GRANT UPDATE(read_at)') + 'GRANT UPDATE(read_at) ON public.workflow_notifications TO authenticated;'.length));
  await db.exec(migration);
  return db;
}
test('approval queues Miguel only; old jobs and repeated saves do not create duplicates', async () => {
  const db = await setup();
  try {
    assert.equal((await db.query('SELECT * FROM workflow_notifications')).rows.length, 0);
    await db.exec(`INSERT INTO active_jobs(source_record_uid,workflow_status,project_name) VALUES ('new','approved','Test Roof'), ('draft','draft','Draft Roof'), ('active','active','Active Roof');`);
    let rows = (await db.query('SELECT * FROM workflow_notifications')).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].user_id, recipient);
    assert.equal(rows[0].email_status, 'pending'); assert.match(rows[0].message, /Test Roof/);
    await db.exec(`UPDATE active_jobs SET workflow_status='approved' WHERE source_record_uid='new';
      UPDATE active_jobs SET workflow_status='active' WHERE source_record_uid='new';
      UPDATE active_jobs SET workflow_status='approved' WHERE source_record_uid='new';
      UPDATE active_jobs SET workflow_status='approved' WHERE source_record_uid='draft';`);
    rows = (await db.query('SELECT * FROM workflow_notifications')).rows;
    assert.equal(rows.length, 2);
    await db.exec(`BEGIN; INSERT INTO active_jobs(source_record_uid,workflow_status) VALUES ('rolled-back','approved'); ROLLBACK;`);
    assert.equal((await db.query('SELECT * FROM workflow_notifications')).rows.length, 2);
    await db.exec(migration);
    assert.equal((await db.query('SELECT * FROM workflow_notifications')).rows.length, 2);
    await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${recipient}',false);`);
    assert.equal((await db.query('SELECT * FROM workflow_notifications')).rows.length, 2);
    await db.exec(`SELECT set_config('test.uid','00000000-0000-0000-0000-000000000099',false);`);
    assert.equal((await db.query('SELECT * FROM workflow_notifications')).rows.length, 0);
    await assert.rejects(db.query('SELECT notify_miguel_job_approved()'), /permission denied/);
  } finally { await db.close(); }
});
test('deployment refuses a missing recipient instead of silently dropping notifications', async () => {
  const db = await setup();
  try {
    await db.exec('DELETE FROM user_profiles');
    await assert.rejects(db.exec(migration), /Expected exactly one Miguel profile/);
  } finally { await db.close(); }
});
