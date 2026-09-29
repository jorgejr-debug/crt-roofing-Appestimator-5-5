import test from 'node:test';
import assert from 'node:assert/strict';
import { Retell } from 'retell-sdk';
import { createInspectionDatabase, creator, ivan, office, outsider, daniela } from './inspectionDatabaseFixture.js';
import { analyzedCall } from './retellFixture.js';
import { createRetellHandler, selectRetellCall } from '../supabase/functions/retell-webhook/handler.js';

const automation = '20000000-0000-0000-0000-000000000001';
test('Retell intake uses the real inspection/task/notification lifecycle atomically', async t => {
  const db = await createInspectionDatabase();
  const intake = async call => (await db.query('SELECT * FROM process_retell_call($1)', [selectRetellCall(call)])).rows[0];
  const asService = () => db.exec("RESET ROLE; SELECT set_config('test.uid','',false); SET ROLE service_role;");
  const owner = () => db.exec('RESET ROLE');
  const counts = async () => {
    await owner();
    const result = {};
    for (const table of ['inspection_requests', 'crm_leads', 'company_tasks', 'company_task_assignees', 'inspection_request_audit', 'company_task_notifications']) {
      result[table] = Number((await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
    }
    await asService();
    return result;
  };
  try {
    await db.query("INSERT INTO auth.users VALUES($1,now()+interval '100 years')", [automation]);
    await db.query("INSERT INTO user_profiles VALUES($1,'AI Phone','ai-phone@automation.crtroofing.invalid','salesperson')", [automation]);
    await db.query("INSERT INTO phone_intake_identity(provider,user_id) VALUES('retell',$1)", [automation]);
    await asService();

    await t.test('routine reroof creates New inspection, CRM source/service, Ivan task and one notification', async () => {
      const event = await intake(analyzedCall('call_reroof'));
      assert.equal(event.processing_status, 'processed');
      assert.equal(event.attempts, 1);
      await owner();
      const r = (await db.query('SELECT * FROM inspection_requests WHERE id=$1', [event.inspection_request_id])).rows[0];
      assert.equal(r.status, 'new'); assert.equal(r.created_by, automation); assert.equal(r.assigned_to, ivan);
      assert.equal(r.urgency, 'Normal'); assert.equal(r.appointment_at, null); assert.ok(r.submitted_at);
      assert.equal(r.contact_name, 'Test Customer'); assert.equal(r.email, 'customer@example.invalid');
      assert.match(r.notes, /Property type: Residential/); assert.match(r.notes, /AI call summary:/);
      assert.match(r.notes, /Retell call ID: call_reroof/); assert.match(r.notes, /Requested employee \(caller preference\): Daniela/);
      const lead = (await db.query('SELECT * FROM crm_leads WHERE id=$1', [r.lead_id])).rows[0];
      assert.equal(lead.lead_source, 'AI Phone'); assert.equal(lead.service_needed, 'Reroof');
      assert.equal(lead.originator_id, automation); assert.equal(lead.assigned_staff_id, ivan);
      const task = (await db.query('SELECT * FROM company_tasks WHERE id=$1', [r.task_id])).rows[0];
      assert.equal(task.created_by, automation); assert.equal(task.priority, 'normal'); assert.equal(task.due_date, null);
      const assignment = (await db.query('SELECT * FROM company_task_assignees WHERE task_id=$1', [task.id])).rows;
      assert.equal(assignment.length, 1); assert.equal(assignment[0].user_id, ivan); assert.equal(assignment[0].assigned_by, automation);
      const notification = (await db.query('SELECT * FROM company_task_notifications WHERE task_id=$1', [task.id])).rows;
      assert.equal(notification.length, 1); assert.equal(notification[0].user_id, ivan); assert.equal(notification[0].email_status, 'pending');
      const audit = (await db.query('SELECT * FROM inspection_request_audit WHERE inspection_request_id=$1', [r.id])).rows;
      assert.ok(audit.length >= 3); assert.ok(audit.every(row => row.actor_id === automation));
      assert.equal((await db.query('SELECT count(*) FROM inspection_requests WHERE lead_id=$1', [lead.id])).rows[0].count, 1, 'CRM capture trigger does not create a second inspection');
      await asService();
      assert.equal((await db.query('SELECT auth.uid() AS id')).rows[0].id, null, 'automation attribution is restored');
    });

    await t.test('urgency mapping preserves existing priorities and never schedules ASAP', async () => {
      const examples = [
        ['Active Leak / Water Intrusion', 'Urgent', 'high'],
        ['Other Urgent Condition', 'High', 'high'],
        ['Routine / No Urgent Issue', 'Normal', 'normal'],
        [null, 'Normal', 'normal'], ['Unknown condition', 'Normal', 'normal'],
      ];
      for (const [reported, expected, priority] of examples) {
        const event = await intake(analyzedCall(`call_urgency_${expected}_${reported}`, { urgency_status: reported, requested_timing: 'ASAP' }));
        assert.equal(event.processing_status, 'processed');
        await owner();
        const r = (await db.query('SELECT * FROM inspection_requests WHERE id=$1', [event.inspection_request_id])).rows[0];
        assert.equal(r.urgency, expected); assert.equal(r.assigned_to, ivan); assert.equal(r.appointment_at, null); assert.equal(r.best_time_to_call, '');
        assert.match(r.notes, /ASAP/);
        assert.equal((await db.query('SELECT priority FROM company_tasks WHERE id=$1', [r.task_id])).rows[0].priority, priority);
        await asService();
      }
    });

    await t.test('retry returns original inspection even when resent analysis changes', async () => {
      const before = await counts();
      const first = await intake(analyzedCall('call_reroof'));
      const replay = await intake(analyzedCall('call_reroof', { caller_name: 'Changed on retry', urgency_status: 'Active Leak / Water Intrusion' }));
      assert.equal(first.inspection_request_id, replay.inspection_request_id);
      assert.equal(replay.call_data.call_analysis.custom_analysis_data.caller_name, 'Test Customer');
      assert.deepEqual(await counts(), before);
    });

    await t.test('concurrent signed HTTP deliveries create one workflow', async () => {
      const before = await counts();
      const key = 'local-test-key';
      const handler = createRetellHandler({ apiKey: key, allowedAgentIds: ['agent_crt_test'], verify: Retell.verify,
        processCall: async call => ({ data: await intake(call) }),
      });
      const raw = JSON.stringify({ event: 'call_analyzed', call: analyzedCall('call_concurrent') });
      const signature = await Retell.sign(raw, key);
      const results = await Promise.all(Array.from({ length: 8 }, async () => {
        const response = await handler(new Request('https://fixture.invalid', { method: 'POST', body: raw, headers: { 'x-retell-signature': signature } }));
        assert.equal(response.status, 200); return response.json();
      }));
      assert.equal(new Set(results.map(result => result.inspection_request_id)).size, 1);
      const after = await counts();
      for (const table of ['inspection_requests', 'crm_leads', 'company_tasks', 'company_task_assignees', 'company_task_notifications']) assert.equal(after[table], before[table] + 1, table);
      assert.equal((await db.query("SELECT count(*) FROM phone_intake_events WHERE external_call_id='call_concurrent'")).rows[0].count, 1);
      await assert.rejects(db.query("INSERT INTO phone_intake_events(provider,event_type,external_call_id,call_data) VALUES('retell','call_analyzed','call_concurrent','{}')"), /unique/);
    });

    await t.test('incomplete or malformed extracted fields retain review data without fabricated customers', async () => {
      const before = await counts();
      const examples = [
        { caller_name: '' }, { callback_number: '', email_address: '', property_address: '' },
        { caller_name: { invalid: true } }, { caller_name: 'x'.repeat(301) },
        { reason_for_call: 'x'.repeat(30001) }, { call_type: null },
      ];
      for (const [index, fields] of examples.entries()) {
        const result = await intake(analyzedCall(`call_incomplete_${index}`, fields));
        assert.equal(result.processing_status, 'needs_review'); assert.equal(result.inspection_request_id, null); assert.ok(result.error_details);
        assert.deepEqual(result.call_data.call_analysis.custom_analysis_data, analyzedCall('', fields).call_analysis.custom_analysis_data);
      }
      assert.deepEqual(await counts(), before);
    });

    await t.test('non-estimate and outbound calls cannot create inspections even at the trusted adapter', async () => {
      const before = await counts();
      assert.equal((await intake(analyzedCall('call_not_estimate', { call_type: 'Existing Job' }))).processing_status, 'ignored');
      assert.equal((await intake({ ...analyzedCall('call_outbound'), direction: 'outbound' })).processing_status, 'ignored');
      assert.deepEqual(await counts(), before);
    });

    await t.test('missing/ambiguous Ivan fails safely and a retry succeeds after correction', async () => {
      const before = await counts();
      await owner(); await db.query("UPDATE user_profiles SET email='ivan-away@example.invalid' WHERE id=$1", [ivan]); await asService();
      const failure = await intake(analyzedCall('call_no_ivan'));
      assert.equal(failure.processing_status, 'failed'); assert.match(failure.error_details, /Ivan.*uniquely/);
      assert.deepEqual(await counts(), before);
      await owner(); await db.query("UPDATE user_profiles SET email='ivan@crtroofing.com' WHERE id=$1", [ivan]);
      await db.query("INSERT INTO user_profiles VALUES('20000000-0000-0000-0000-000000000002','Duplicate','IVAN@CRTROOFING.COM','salesperson')"); await asService();
      assert.equal((await intake(analyzedCall('call_ambiguous_ivan'))).processing_status, 'failed');
      await owner(); await db.exec("DELETE FROM user_profiles WHERE id='20000000-0000-0000-0000-000000000002'"); await asService();
      const recovered = await intake(analyzedCall('call_no_ivan'));
      assert.equal(recovered.processing_status, 'processed'); assert.equal(recovered.attempts, 2);
    });

    await t.test('unprovisioned or login-enabled automation identity cannot submit', async () => {
      const before = await counts();
      await owner(); await db.query('UPDATE auth.users SET banned_until=NULL WHERE id=$1', [automation]); await asService();
      assert.equal((await intake(analyzedCall('call_unbanned_actor'))).processing_status, 'failed');
      assert.deepEqual(await counts(), before);
      await owner(); await db.query("UPDATE auth.users SET banned_until=now()+interval '100 years' WHERE id=$1", [automation]); await asService();
    });

    await t.test('late notification failure rolls back every customer workflow record and keeps delivery error', async () => {
      const before = await counts();
      await owner();
      await db.exec("CREATE FUNCTION fail_notification_fixture() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Fixture notification failure'; END$$; CREATE TRIGGER fail_notification_fixture BEFORE INSERT ON company_task_notifications FOR EACH ROW EXECUTE FUNCTION fail_notification_fixture();");
      await asService();
      const failure = await intake(analyzedCall('call_rollback'));
      assert.equal(failure.processing_status, 'failed'); assert.match(failure.error_details, /Fixture notification failure/);
      assert.equal(failure.inspection_request_id, null); assert.deepEqual(await counts(), before);
      assert.equal((await db.query('SELECT auth.uid() AS id')).rows[0].id, null);
      await owner(); await db.exec('DROP TRIGGER fail_notification_fixture ON company_task_notifications'); await asService();
      assert.equal((await intake(analyzedCall('call_rollback'))).processing_status, 'processed');
    });

    await t.test('Ivan can inspect an AI intake and hand it to the existing Daniela proposal gate', async () => {
      const event = await intake(analyzedCall('call_handoff', { urgency_status: 'Active Leak / Water Intrusion' }));
      await owner();
      let row = (await db.query('SELECT * FROM inspection_requests WHERE id=$1', [event.inspection_request_id])).rows[0];
      await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${ivan}',false)`);
      row = (await db.query('SELECT * FROM save_inspection_request($1,$2,$3)', [row.id, { findings: 'Fixture roof findings', measurements: '100 sq ft' }, row.version])).rows[0];
      row = (await db.query("SELECT * FROM transition_inspection_request($1,'inspected',$2)", [row.id, row.version])).rows[0];
      row = (await db.query('SELECT * FROM create_inspection_proposal_request($1,$2)', [row.id, row.version])).rows[0];
      assert.equal(row.status, 'proposal_requested');
      await owner();
      const proposal = (await db.query('SELECT * FROM proposal_requests WHERE id=$1', [row.proposal_request_id])).rows[0];
      assert.equal(proposal.salesperson_id, ivan); assert.equal(proposal.priority, 'high');
      assert.equal(proposal.draft_handoff_status, 'awaiting_review');
      const notifications = (await db.query('SELECT * FROM proposal_test_notifications WHERE request_id=$1', [proposal.id])).rows;
      assert.ok(notifications.some(notification => notification.user_id === daniela));
      await asService();
    });

    await t.test('employees cannot invoke trusted intake, change source or access restricted ledger', async () => {
      await owner();
      for (const role of ['anon', 'authenticated']) {
        await db.exec(`SET ROLE ${role}`);
        await assert.rejects(intake(analyzedCall('call_forged')), /permission denied/);
        await assert.rejects(db.query("SELECT * FROM submit_inspection_request_internal($1,1,'AI Phone','Forged')", [creator]), /permission denied/);
        await assert.rejects(db.query('SELECT * FROM phone_intake_identity'), /permission denied/);
        await owner();
      }
      await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${outsider}',false)`);
      assert.equal((await db.query('SELECT * FROM phone_intake_events')).rows.length, 0);
      await db.exec(`SELECT set_config('test.uid','${office}',false)`);
      assert.ok((await db.query('SELECT * FROM phone_intake_events')).rows.length > 0);
      await assert.rejects(db.exec("UPDATE phone_intake_events SET processing_status='received'"), /permission denied/);
      await db.exec(`SELECT set_config('test.uid','${creator}',false)`);
      const draft = (await db.query('SELECT * FROM save_inspection_request($1,$2,0)', ['30000000-0000-0000-0000-000000000001', { contact_name: 'Manual', phone: '555', source: 'AI Phone', service_needed: 'Forged' }])).rows[0];
      const submitted = (await db.query('SELECT * FROM submit_inspection_request($1,$2)', [draft.id, draft.version])).rows[0];
      await owner();
      const lead = (await db.query('SELECT * FROM crm_leads WHERE id=$1', [submitted.lead_id])).rows[0];
      assert.equal(lead.lead_source, 'Phone Call / Office'); assert.equal(lead.service_needed, 'Roof inspection');
      assert.equal(submitted.created_by, creator);
    });
  } finally { await db.close(); }
});
