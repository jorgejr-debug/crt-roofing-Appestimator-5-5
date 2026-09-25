import test from 'node:test';import assert from 'node:assert/strict';
import {inspectionDraft,inspectionTiming,appointmentInput,appointmentIso} from './inspectionRequests.js';
import {collectWorkflowAlerts,notificationRecipients} from '../supabase/functions/_shared/workflow-alerts.js';
test('previous mobile drafts retain their contact information in the request center',()=>{const draft=inspectionDraft({id:'old',contactName:'Client',propertyAddress:'Address',description:'Roof leak',bestTimeToCall:'Morning'});assert.equal(draft.id,'old');assert.equal(draft.contact_name,'Client');assert.equal(draft.notes,'Roof leak');assert.equal(draft.property_address,'Address');});
test('appointment editing preserves an existing instant across local-time round trips',()=>{const iso='2026-10-01T16:30:00.000Z';assert.equal(appointmentIso(appointmentInput(iso)),iso);assert.equal(appointmentIso(''),null);});
test('inspection reminders honor contact timing, scheduling, holds and closed requests',()=>{
 const now=new Date('2026-10-01T16:00:00Z');const base={id:'r',request_number:1,contact_name:'Local fixture',assigned_to:'ivan',status:'new',submitted_at:'2026-09-30T16:00:00Z'};
 assert.equal(inspectionTiming(base,now),'Awaiting contact');
 let alerts=collectWorkflowAlerts({inspections:[base]},now);assert.deepEqual(alerts.map(x=>x.kind),['inspection_contact_due']);
 assert.deepEqual(notificationRecipients(alerts[0],[{id:'ivan',role:'salesperson'},{id:'other',role:'salesperson'},{id:'office',email:'natalia@crtroofing.com'}]),['ivan','office']);
 assert.equal(collectWorkflowAlerts({inspections:[base]},new Date('2026-10-01T15:59:59Z')).length,0);
 for(const status of ['draft','on_hold','cancelled','proposal_requested','inspected']) assert.equal(collectWorkflowAlerts({inspections:[{...base,status}]},now).length,0);
 const scheduled={...base,status:'scheduled',appointment_at:'2026-10-02T15:00:00Z'};
 alerts=collectWorkflowAlerts({inspections:[scheduled]},now);assert.equal(alerts[0].kind,'inspection_appointment_upcoming');
 assert.equal(collectWorkflowAlerts({inspections:[{...scheduled,appointment_at:'2026-10-01T15:00:00Z'}]},now)[0].kind,'inspection_appointment_missed');
 assert.equal(collectWorkflowAlerts({inspections:[{...scheduled,appointment_at:'invalid'}]},now).length,0);
});
