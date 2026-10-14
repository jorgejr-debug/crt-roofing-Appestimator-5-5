import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createJobCommissionPlan } from '../src/approvedDailyProgress.js';

test('defaults select only the named salespeople', () => {
  assert.deepEqual(createJobCommissionPlan('Ivan and Chris'), { ivan: { enabled: true, rate: .05 }, chris: { enabled: true, rate: .15 } });
  assert.equal(createJobCommissionPlan().ivan.enabled, false);
  assert.equal(createJobCommissionPlan().chris.enabled, false);
});

test('job attribution initializes new commissions and preserves edited and legacy settings', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE user_profiles(id int, full_name text, email text);
      CREATE TABLE proposal_requests(id int, source_lead_id int, salesperson_id int, lead_originator_id int, lead_originator_name text, lead_originator_email text);
      CREATE TABLE active_jobs(id int, proposal_request_id int, job_payload jsonb);
      INSERT INTO user_profiles VALUES(1, 'Ivan', 'ivan@crtroofing.com');
      INSERT INTO proposal_requests VALUES(1, 1, 1, 2, 'Chris', 'chris@crtroofing.com');
      INSERT INTO active_jobs VALUES(2,1,'{"salesCommissionRate":0.25}');`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261009120000_job_commission_plan.sql', import.meta.url), 'utf8'));
    await db.exec(`CREATE TRIGGER attribution BEFORE INSERT OR UPDATE OF job_payload ON active_jobs FOR EACH ROW EXECUTE FUNCTION carry_lead_attribution_to_job();
      INSERT INTO active_jobs VALUES(1,1,'{}');`);
    let { rows } = await db.query('SELECT job_payload FROM active_jobs WHERE id=1');
    assert.deepEqual(rows[0].job_payload.commissionPlan, createJobCommissionPlan('Ivan Chris'));
    await db.exec(`UPDATE active_jobs SET job_payload=jsonb_set(job_payload,'{commissionPlan,chris,rate}','0.12') WHERE id=1;
      UPDATE active_jobs SET job_payload=job_payload || '{"dailyProgressLog":[]}' WHERE id=2;`);
    ({ rows } = await db.query('SELECT id,job_payload FROM active_jobs ORDER BY id'));
    assert.equal(rows[0].job_payload.commissionPlan.chris.rate, .12);
    assert.equal(rows[1].job_payload.salesCommissionRate, .25);
    assert.equal(rows[1].job_payload.commissionPlan, undefined);
  } finally { await db.close(); }
});
