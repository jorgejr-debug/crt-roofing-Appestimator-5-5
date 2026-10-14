import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInspectionDatabase,creator,ivan,office,outsider} from './inspectionDatabaseFixture.js';
import {canShowOwnerTaskView,selectOwnerTasks} from '../src/taskOwnerView.js';

test('owner can read tasks and discussions without gaining participant writes',async()=>{
 const db=await createInspectionDatabase();
 const task='30000000-0000-0000-0000-000000000001';
 try {
  await db.exec('ALTER TABLE auth.users ADD COLUMN email text');
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,'jorgejr@crtroofing.com'),($2,'other@example.invalid')",[office,outsider]);
  await db.query("UPDATE user_profiles SET email='jorgejr@crtroofing.com' WHERE id=$1",[office]);
  await db.query("INSERT INTO company_tasks(id,created_by,title,status) VALUES($1,$2,'Private employee task','open')",[task,creator]);
  await db.query('INSERT INTO company_task_assignees(task_id,user_id,assigned_by) VALUES($1,$2,$3)',[task,ivan,creator]);
  await db.query("INSERT INTO company_task_comments(id,task_id,author_id,body) VALUES(gen_random_uuid(),$1,$2,'Private task discussion')",[task,ivan]);
  const baseline=readFileSync(new URL('../supabase_migration.sql',import.meta.url),'utf8');
  const start=baseline.lastIndexOf('CREATE OR REPLACE FUNCTION public.can_access_company_task');
  await db.exec(baseline.slice(start,baseline.indexOf('COMMIT;',start)));
  await db.exec(`ALTER TABLE company_tasks ENABLE ROW LEVEL SECURITY;ALTER TABLE company_task_assignees ENABLE ROW LEVEL SECURITY;ALTER TABLE company_task_comments ENABLE ROW LEVEL SECURITY;
   GRANT SELECT,INSERT,UPDATE,DELETE ON company_tasks,company_task_assignees,company_task_comments TO authenticated;`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261002160000_owner_task_read_view.sql',import.meta.url),'utf8'));
  const as=async id=>db.query("SELECT set_config('test.uid',$1,false)",[id]);
  await db.exec('SET ROLE authenticated');await as(office);
  for(const table of ['company_tasks','company_task_assignees','company_task_comments']) assert.equal((await db.query('SELECT * FROM '+table)).rows.length,1);
  assert.equal((await db.query('SELECT can_access_company_task($1) AS allowed',[task])).rows[0].allowed,false);
  assert.equal((await db.query("UPDATE company_tasks SET status='completed' WHERE id=$1 RETURNING id",[task])).rows.length,0);
  assert.equal((await db.query('DELETE FROM company_tasks WHERE id=$1 RETURNING id',[task])).rows.length,0);
  await assert.rejects(db.query("INSERT INTO company_task_comments(id,task_id,author_id,body) VALUES(gen_random_uuid(),$1,$2,'not allowed')",[task,office]),/row-level security/);
  await assert.rejects(db.query('INSERT INTO company_task_assignees(task_id,user_id,assigned_by) VALUES($1,$2,$2)',[task,office]),/row-level security/);
  await as(outsider);
  for(const table of ['company_tasks','company_task_assignees','company_task_comments']) assert.equal((await db.query('SELECT * FROM '+table)).rows.length,0);
  await db.exec('RESET ROLE');
  // Copying an owner email into a profile cannot grant owner oversight.
  await db.query("UPDATE user_profiles SET email='jorgejr@crtroofing.com',role='cfo' WHERE id=$1",[outsider]);
  await db.exec('SET ROLE authenticated');await as(outsider);
  assert.equal((await db.query('SELECT can_review_all_company_tasks() AS allowed')).rows[0].allowed,false);
  await as(ivan);
  assert.equal((await db.query('SELECT * FROM company_tasks')).rows.length,1);
  assert.equal((await db.query("UPDATE company_tasks SET status='in_progress' WHERE id=$1 RETURNING id",[task])).rows.length,1);
  await db.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(db.query('SELECT can_review_all_company_tasks()'),/permission denied/);
 } finally {await db.close();}
});
test('owner UI eligibility and employee filter do not widen ordinary task views',()=>{
 assert.equal(canShowOwnerTaskView({email:'jorgejr@crtroofing.com',role:'cfo'}),true);
 assert.equal(canShowOwnerTaskView({email:'natalia@crtroofing.com',role:'admin'}),false);
 assert.equal(canShowOwnerTaskView({email:'jorgejr@crtroofing.com',role:'employee'}),false);
 const tasks=[{id:'a'},{id:'b'}];
 assert.deepEqual(selectOwnerTasks(tasks,[{task_id:'b',user_id:'natalia'}],'natalia'),[{id:'b'}]);
 assert.deepEqual(selectOwnerTasks(tasks,[],''),tasks);
});
