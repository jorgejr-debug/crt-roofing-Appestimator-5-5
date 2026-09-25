import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAccessibleFieldLogRows,ownFieldLogsForCache} from './fieldLogAccess.js';
test('office query reads the RLS-visible set across pages without an owner restriction',async()=>{
 const rows=Array.from({length:501},(_,id)=>({id,user_key:id===500?'crew':'self'}));const ranges=[];
 const query={select(){return this;},order(){return this;},async range(start,end){ranges.push([start,end]);return {data:rows.slice(start,end+1),error:null};}};
 const result=await fetchAccessibleFieldLogRows({from(name){assert.equal(name,'field_daily_logs');return query;}});
 assert.equal(result.data.length,501);assert.equal(result.data[500].user_key,'crew');assert.deepEqual(ranges,[[0,499],[500,999]]);
});
test('review query fails visibly and does not return a partial list',async()=>{
 let calls=0;const error=new Error('Connection lost');const query={select(){return this;},order(){return this;},async range(){return ++calls===1?{data:Array(500).fill({})}:{error};}};
 assert.deepEqual(await fetchAccessibleFieldLogRows({from:()=>query}),{data:[],error});
});
test('offline cache retains own and legacy device logs but excludes other employees',()=>{
 const logs=[{id:'own',ownerUserKey:'self'},{id:'legacy'},{id:'crew',ownerUserKey:'other'}];
 assert.deepEqual(ownFieldLogsForCache(logs,'self'),logs.slice(0,2));
});
