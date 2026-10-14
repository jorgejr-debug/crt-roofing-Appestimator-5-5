export const analyzedCall = (id = 'call_fixture', fields = {}) => ({
  call_id: id, agent_id: 'agent_crt_test', call_type: 'phone_call', direction: 'inbound',
  from_number: '+15555550101', to_number: '+15555550102', start_timestamp: 1790697600000,
  call_analysis: { call_summary: 'Caller requests a reroof estimate.', custom_analysis_data: {
    call_type: 'New Estimate', caller_name: 'Test Customer', callback_number: '+15555550101',
    email_address: 'customer@example.invalid', property_address: 'Fixture address',
    property_type: 'Residential', reason_for_call: 'Replace an aging roof',
    urgency_status: 'Routine / No Urgent Issue', requested_timing: 'Next week',
    requested_employee: 'Daniela', roofing_work_requested: 'Reroof', ...fields,
  } },
});
