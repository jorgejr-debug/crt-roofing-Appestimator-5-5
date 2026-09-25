export const INSPECTION_STATUSES = { draft:'Draft',new:'New',contacted:'Contacted',scheduled:'Scheduled',inspected:'Inspected',proposal_requested:'Proposal Requested',on_hold:'On Hold',cancelled:'Cancelled' };
export const inspectionClosed = row => ['proposal_requested','cancelled'].includes(row.status);
export function inspectionTiming(row, now = new Date()) {
 if (inspectionClosed(row) || ['draft','on_hold'].includes(row.status)) return '';
 const submitted = Date.parse(row.submitted_at), appointment = Date.parse(row.appointment_at);
 if (row.status === 'new' && Number.isFinite(submitted) && now.getTime()-submitted >= 86400000) return 'Awaiting contact';
 if (row.status === 'scheduled' && Number.isFinite(appointment)) return appointment < now.getTime() ? 'Appointment passed — confirm outcome' : appointment-now.getTime()<=86400000 ? 'Appointment within 24 hours' : '';
 return '';
}
export function inspectionDraft(saved = {}) {
 return { id: saved.id || crypto.randomUUID(), version:saved.version || 0, contact_name:saved.contact_name ?? saved.contactName ?? '', phone:saved.phone || '', email:saved.email || '', property_address:saved.property_address ?? saved.propertyAddress ?? '', best_time_to_call:saved.best_time_to_call ?? saved.bestTimeToCall ?? '', urgency:saved.urgency || 'Normal', notes:saved.notes ?? saved.description ?? '', assigned_to:saved.assigned_to || '' };
}
export function appointmentInput(iso) {
 if (!iso) return ''; const date = new Date(iso); if (!Number.isFinite(date.getTime())) return '';
 return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
export function appointmentIso(input) { return input ? new Date(input).toISOString() : null; }
export function inspectionDate(value) { return value ? new Date(value).toLocaleString() : 'Not scheduled'; }
export async function readInspectionRows(supabase, table, filter) {
 const rows=[];
 for(let offset=0;offset<50000;offset+=500){
  let query=supabase.from(table).select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+499);
  if(filter)query=filter(query);const {data,error}=await query;if(error)throw error;
  rows.push(...(data || []));if((data || []).length<500)return rows;
 }
 throw new Error('Too many records to load. Contact the office to narrow the request.');
}
