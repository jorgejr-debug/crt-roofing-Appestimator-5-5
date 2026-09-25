import test from 'node:test';
import assert from 'node:assert/strict';
import {createTaskUpload,saveTaskAttachment,validateTaskAttachment} from './taskAttachments.js';
test('task upload paths do not trust filenames and file validation supports phone photos',()=>{
 const file={name:'../../Photo.HEIC',size:123};
 assert.equal(validateTaskAttachment(file),'');
 assert.equal(createTaskUpload('task','user',file,'uuid').path,'task/user/uuid.heic');
 assert.match(validateTaskAttachment({name:'page.html',size:2}),/not a supported/);
 assert.match(validateTaskAttachment({name:'big.pdf',size:26*1024*1024}),/larger/);
});
test('registration failure retries the same attachment without uploading another file',async()=>{
 let uploads=0,registers=0;
 const supabase={storage:{from:()=>({upload:async()=>{uploads++;return {error:null};}})},rpc:async(name,args)=>{assert.equal(name,'register_task_attachment');assert.equal(args.p_id,'uuid');registers++;return registers===1?{error:new Error('offline')}:{data:{id:'uuid'}};}};
 const entry=createTaskUpload('task','user',{name:'photo.jpg',size:1},'uuid');
 await assert.rejects(saveTaskAttachment(supabase,'task',entry),/offline/);
 assert.equal((await saveTaskAttachment(supabase,'task',entry)).id,'uuid');assert.equal(uploads,1);assert.equal(registers,2);
});
test('lost upload responses can recover through conflict and server registration',async()=>{
 let count=0;
 const supabase={storage:{from:()=>({upload:async()=>({error:++count===1?{message:'network'}:{statusCode:'409'}})})},rpc:async()=>({data:{id:'uuid'}})};
 const entry=createTaskUpload('t','u',{name:'a.pdf',size:10},'uuid');
 await assert.rejects(saveTaskAttachment(supabase,'t',entry));
 assert.equal((await saveTaskAttachment(supabase,'t',entry)).id,'uuid');
});
