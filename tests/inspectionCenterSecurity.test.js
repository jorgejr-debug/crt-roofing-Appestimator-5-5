import test from 'node:test';
import assert from 'node:assert/strict';
import {createInspectionDatabase,creator,ivan,office,daniela,outsider,request,file} from './inspectionDatabaseFixture.js';
test('inspection lifecycle preserves draft privacy, files, history, retry safety and the proposal review gate',async()=>{
 const db=await createInspectionDatabase();
 try{
 const as=async id=>db.exec(`RESET ROLE;SET ROLE authenticated;SELECT set_config('test.uid','${id}',false)`);
 const rpc=async(fn,args)=> (await db.query(`SELECT * FROM ${fn}(${args.map((_,i)=>`$${i+1}`).join(',')})`,args)).rows[0];
 await as(creator);let row=await rpc('save_inspection_request',[request,{contact_name:'Local test only',phone:'555',property_address:'Local fixture address'},0]);
 assert.equal(row.assigned_to,ivan);assert.equal(row.status,'draft');
 await assert.rejects(rpc('save_inspection_request',[request,{notes:'stale'},0]),/changed/);
 const path=`${request}/${creator}/${file}.jpg`;
 await db.query('INSERT INTO storage.objects(bucket_id,name,metadata) VALUES($1,$2,$3)',['inspection-attachments',path,{size:123}]);
 await rpc('register_inspection_attachment',[request,file,path,'photo.jpg',123]);await rpc('register_inspection_attachment',[request,file,path,'photo.jpg',123]);
 for(const person of [ivan,office,daniela,outsider]){await as(person);assert.equal((await db.query('SELECT * FROM inspection_requests')).rows.length,0);assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0);await assert.rejects(rpc('submit_inspection_request',[request,row.version]),/creator/);}
 await as(creator);row=await rpc('submit_inspection_request',[request,row.version]);const taskId=row.task_id;
 assert.equal((await rpc('submit_inspection_request',[request,1])).task_id,taskId);
 assert.equal((await db.query('SELECT * FROM inspection_requests')).rows.length,1,'CRM trigger does not duplicate the request');
 for(const person of [ivan,office]){await as(person);assert.equal((await db.query('SELECT * FROM inspection_requests')).rows.length,1);assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,1);}
 await as(outsider);assert.equal((await db.query('SELECT * FROM inspection_requests')).rows.length,0);await assert.rejects(rpc('transition_inspection_request',[request,'inspected',row.version]),/access/);
 await as(ivan);await assert.rejects(rpc('transition_inspection_request',[request,'scheduled',row.version]),/appointment/);
 await assert.rejects(rpc('transition_inspection_request',[request,'inspected',row.version]),/findings/);
 row=await rpc('save_inspection_request',[request,{appointment_at:'2026-10-01T16:00:00Z',findings:'Measured roof coating scope',measurements:'100 sq ft'},row.version]);
 row=await rpc('transition_inspection_request',[request,'scheduled',row.version]);row=await rpc('transition_inspection_request',[request,'inspected',row.version]);
 row=await rpc('create_inspection_proposal_request',[request,row.version]);assert.equal(row.status,'proposal_requested');
 assert.equal((await rpc('create_inspection_proposal_request',[request,1])).proposal_request_id,row.proposal_request_id,'handoff retry does not create duplicate proposals');
 await as(daniela);assert.equal((await db.query('SELECT * FROM inspection_requests')).rows.length,1,'proposal reviewer receives linked inspection evidence');assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,1);
 await assert.rejects(rpc('save_inspection_request',[request,{findings:'forged'},row.version]),/access/);
 await assert.rejects(db.exec("UPDATE inspection_requests SET status='new'"),/permission denied/);
 await assert.rejects(db.exec('DELETE FROM inspection_request_audit'),/permission denied/);
 await as(office);await assert.rejects(rpc('save_inspection_request',[request,{notes:'change closed'},row.version]),/closed/);
 const history=(await db.query('SELECT * FROM inspection_request_audit ORDER BY created_at')).rows;
 assert.equal(history.filter(x=>x.action==='attachment_added').length,1);assert.ok(history.some(x=>x.details.after?.status==='inspected'));
 await db.exec('RESET ROLE');const proposal=(await db.query('SELECT * FROM proposal_requests')).rows[0];assert.equal(proposal.draft_handoff_status,'awaiting_review');assert.equal(proposal.scope_of_work,'Measured roof coating scope');assert.equal(proposal.measurements,'100 sq ft');assert.equal(proposal.salesperson_id,ivan);
 assert.equal((await db.query('SELECT * FROM company_tasks')).rows.length,2);
 assert.equal((await db.query('SELECT * FROM proposal_test_notifications')).rows[0].user_id,daniela);
 await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM inspection_requests'),/permission denied/);
 }finally{await db.close();}
});
