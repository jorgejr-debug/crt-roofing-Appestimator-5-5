import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('legacy job tables require a provisioned company account and preserve existing member operations',async()=>{
 const db=new PGlite();const member='00000000-0000-0000-0000-000000000001', outsider='00000000-0000-0000-0000-000000000002';
 try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated,anon;
 CREATE TABLE user_profiles(id uuid PRIMARY KEY);INSERT INTO user_profiles VALUES('${member}');`);
 const tables=['approved_jobs','completed_jobs','completed_job_metrics'];
 for(const name of tables)await db.exec(`CREATE TABLE ${name}(id text PRIMARY KEY,note text);INSERT INTO ${name} VALUES('history','preserved');GRANT ALL ON ${name} TO anon,authenticated;`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20260925140000_protect_legacy_job_tables.sql',import.meta.url),'utf8'));
 await db.exec('SET ROLE anon');
 for(const name of tables)await assert.rejects(db.query(`SELECT * FROM ${name}`),/permission denied/);
 await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('test.uid','${outsider}',false)`);
 for(const name of tables){assert.equal((await db.query(`SELECT * FROM ${name}`)).rows.length,0);await assert.rejects(db.query(`INSERT INTO ${name} VALUES('attack','blocked')`),/row-level security/);}
 await db.exec(`SELECT set_config('test.uid','${member}',false)`);
 for(const name of tables){
  assert.deepEqual((await db.query(`SELECT * FROM ${name}`)).rows,[{id:'history',note:'preserved'}]);
  await db.exec(`INSERT INTO ${name} VALUES('new','entry');UPDATE ${name} SET note='edited' WHERE id='new';DELETE FROM ${name} WHERE id='new';`);
  await assert.rejects(db.query(`TRUNCATE ${name}`),/permission denied/);
 }
 await db.exec(`RESET ROLE;DELETE FROM user_profiles WHERE id='${member}';SET ROLE authenticated;`);
 assert.equal((await db.query('SELECT * FROM completed_jobs')).rows.length,0);
 }finally{await db.close();}
});
