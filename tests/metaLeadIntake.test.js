import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validSignature, leadEvents, mapMetaLead } from '../supabase/functions/_shared/meta-leads.js';

test('only authenticated, untampered webhook payloads pass', async () => {
  const raw = '{"object":"page"}';
  const sig = 'sha256=' + createHmac('sha256', 'secret').update(raw).digest('hex');
  assert.equal(await validSignature(raw, sig, 'secret'), true);
  assert.equal(await validSignature(raw + ' ', sig, 'secret'), false);
  assert.equal(await validSignature(raw, sig, 'wrong'), false);
  assert.equal(await validSignature(raw, null, 'secret'), false);
});
test('only configured Page and form lead events are accepted', () => {
  const payload = { object: 'page', entry: [{ id: '12', changes: [
    { field: 'leadgen', value: { form_id: '34', leadgen_id: '56' } },
    { field: 'leadgen', value: { form_id: '99', leadgen_id: '57' } },
    { field: 'feed', value: { form_id: '34', leadgen_id: '58' } },
  ] }] };
  assert.deepEqual(leadEvents(payload, '12', '34').map(x => x.leadgen_id), ['56']);
  assert.deepEqual(leadEvents(payload, '99', '34'), []);
});
test('fields map to CRM without assuming an address or qualification', () => {
  const mapped = mapMetaLead({ id: '56', field_data: [
    { name: 'full_name', values: ['Test Contact'] },
    { name: 'property_question', values: ['Commercial or Industrial'] },
  ] }, 'property_question');
  assert.equal(mapped.contact_name, 'Test Contact');
  assert.equal(mapped.lead_payload.propertyType, 'Commercial or Industrial');
  assert.equal(mapped.phone, '');
  assert.equal(mapped.qualification_status, undefined);
});
test('database retries preserve reviewed leads and reject invalid owner', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE user_profiles(id uuid PRIMARY KEY, full_name text, email text, role text);
      CREATE TABLE crm_leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_by uuid, originator_id uuid,
        originator_name text, originator_email text, relationship_owner_id uuid, assigned_staff_id text,
        contact_name text, phone text, email text, lead_source text, service_needed text, quick_note text, lead_payload jsonb);
      INSERT INTO user_profiles VALUES ('00000000-0000-0000-0000-000000000001','Owner','owner@example.com','cfo');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261014230000_meta_lead_intake.sql', import.meta.url), 'utf8'));
    const args = ['56', '00000000-0000-0000-0000-000000000001', JSON.stringify({contact_name:'Original'}), '{}'];
    const a = await db.query('SELECT ingest_meta_lead($1,$2,$3,$4) AS id', args);
    await db.exec("UPDATE crm_leads SET contact_name='Reviewed'");
    const b = await db.query('SELECT ingest_meta_lead($1,$2,$3,$4) AS id', args);
    assert.equal(a.rows[0].id, b.rows[0].id);
    const rows = (await db.query('SELECT * FROM crm_leads')).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].contact_name, 'Reviewed');
    assert.equal(rows[0].lead_source, 'Meta Ads');
    await assert.rejects(db.query('SELECT ingest_meta_lead($1,$2,$3,$4)', ['57','00000000-0000-0000-0000-000000000002','{}','{}']));
    const perms = await db.query("SELECT has_function_privilege('authenticated','ingest_meta_lead(text,uuid,jsonb,jsonb)','EXECUTE') AS allowed");
    assert.equal(perms.rows[0].allowed, false);
  } finally { await db.close(); }
});

test('Meta intake coexists with Retell and waits for explicit office handoff to Ivan', async () => {
  const { createInspectionDatabase, office, ivan } = await import('./inspectionDatabaseFixture.js');
  const db = await createInspectionDatabase();
  try {
    // Restore production CRM defaults omitted by the shared inspection fixture.
    await db.exec("ALTER TABLE crm_leads ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN status SET DEFAULT 'New', ALTER COLUMN qualification_status SET DEFAULT 'captured', ADD COLUMN lead_payload jsonb DEFAULT '{}'::jsonb");
    await db.exec(await readFile(new URL('../supabase/migrations/20261014230000_meta_lead_intake.sql', import.meta.url), 'utf8'));
    await db.exec('SET ROLE service_role');
    const args = ['123456', office, JSON.stringify({contact_name:'Meta Test', phone:'5550100'}), '{}'];
    const id = (await db.query('SELECT ingest_meta_lead($1,$2,$3,$4) AS id', args)).rows[0].id;
    await db.exec('RESET ROLE');
    const lead = (await db.query('SELECT * FROM crm_leads WHERE id=$1', [id])).rows[0];
    assert.equal(lead.assigned_staff_id, office);
    assert.equal(lead.qualification_status, 'captured');
    for (const table of ['inspection_requests', 'company_tasks', 'company_task_notifications']) {
      assert.equal(Number((await db.query('SELECT count(*) FROM ' + table)).rows[0].count), 0);
    }
    assert.ok((await db.query("SELECT to_regprocedure('process_retell_call(jsonb)') AS fn")).rows[0].fn);
    await db.query("UPDATE crm_leads SET property_address='123 Test St', qualification_status='qualified', assigned_staff_id=$2 WHERE id=$1", [id, ivan]);
    await db.query("SELECT set_config('test.uid',$1,false)", [office]);
    await db.exec('SET ROLE authenticated');
    const task = (await db.query("SELECT * FROM create_inspection_request_task($1,'Review roof','Office reviewed','normal',$2)", [id, ivan])).rows[0];
    await db.exec('RESET ROLE');
    const request = (await db.query('SELECT * FROM inspection_requests WHERE lead_id=$1', [id])).rows[0];
    assert.equal(request.assigned_to, ivan);
    assert.equal(request.task_id, task.id);
    await db.exec('SET ROLE service_role');
    assert.equal((await db.query('SELECT ingest_meta_lead($1,$2,$3,$4) AS id', args)).rows[0].id, id);
    await db.exec('RESET ROLE');
    assert.equal(Number((await db.query('SELECT count(*) FROM company_tasks')).rows[0].count), 1);
  } finally { await db.close(); }
});
