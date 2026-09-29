const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_SELECTED_BYTES = 90000;
const extractedKeys = ['call_type', 'caller_name', 'callback_number', 'property_address',
  'property_type', 'reason_for_call', 'urgency_status', 'requested_timing',
  'requested_employee', 'email_address', 'roofing_work_requested'];
const metadataKeys = ['call_id', 'agent_id', 'call_type', 'direction', 'from_number',
  'to_number', 'start_timestamp', 'end_timestamp', 'duration_ms', 'call_status', 'disconnection_reason'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Do not retain recordings, transcripts, dynamic variables or arbitrary metadata.
// Preserve missing/malformed analysis so SQL can retain it for office review.
export function selectRetellCall(call) {
  const analysis = object(call.call_analysis) ? call.call_analysis : {};
  return {
    ...pick(call, metadataKeys),
    call_analysis: {
      ...pick(analysis, ['call_summary', 'call_successful', 'user_sentiment', 'in_voicemail']),
      custom_analysis_data: object(analysis.custom_analysis_data)
        ? pick(analysis.custom_analysis_data, extractedKeys) : null,
    },
  };
}

async function rawBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

// Dependencies are injected so tests exercise the same HTTP handler as Deno.
export function createRetellHandler({ apiKey, allowedAgentIds, verify, processCall }) {
  return async request => {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    if (!apiKey || !allowedAgentIds?.length) return json(503, { error: 'Retell intake is not configured' });
    const signature = request.headers.get('x-retell-signature');
    if (!signature) return json(401, { error: 'Invalid signature' });
    let raw;
    try { raw = await rawBody(request); } catch { return json(400, { error: 'Invalid request body' }); }
    if (raw === null) return json(413, { error: 'Webhook body too large' });
    try {
      // Verify the original raw body, never JSON.stringify(parsedPayload).
      if (!await verify(raw, apiKey, signature)) return json(401, { error: 'Invalid signature' });
    } catch { return json(401, { error: 'Invalid signature' }); }
    let payload;
    try { payload = JSON.parse(raw); } catch { return json(400, { error: 'Invalid JSON' }); }
    if (!object(payload)) return json(400, { error: 'Invalid event' });
    if (payload.event !== 'call_analyzed') return json(200, { status: 'ignored' });
    const call = payload.call;
    if (!object(call)) return json(400, { error: 'Missing call' });
    if (typeof call.agent_id !== 'string' || !allowedAgentIds.includes(call.agent_id)) return json(403, { error: 'Unapproved agent' });
    if (call.call_type !== 'phone_call' || call.direction !== 'inbound') return json(200, { status: 'ignored' });
    if (typeof call.call_id !== 'string' || !call.call_id.trim() || call.call_id.length > 200) return json(400, { error: 'Invalid call ID' });
    const selected = selectRetellCall(call);
    if (new TextEncoder().encode(JSON.stringify(selected)).length > MAX_SELECTED_BYTES) return json(413, { error: 'Extracted call data too large' });
    try {
      const { data, error } = await processCall(selected);
      const result = Array.isArray(data) ? data[0] : data;
      if (error || !result || !['processed', 'ignored', 'needs_review', 'failed'].includes(result.processing_status)) {
        return json(503, { error: 'Intake could not be confirmed; retry delivery' });
      }
      // Errors and PII remain in the restricted ledger, not HTTP responses/logs.
      // A failed transaction is retryable. Needs-review is durably accepted.
      return json(result.processing_status === 'failed' ? 503 : 200, {
        status: result.processing_status,
        inspection_request_id: result.inspection_request_id || null,
      });
    } catch { return json(503, { error: 'Intake unavailable; retry delivery' }); }
  };
}
