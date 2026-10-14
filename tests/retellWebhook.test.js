import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Retell } from 'retell-sdk';
import { createRetellHandler, selectRetellCall } from '../supabase/functions/retell-webhook/handler.js';

const apiKey = 'local-fixture-secret-not-a-real-retell-key';
import { analyzedCall } from './retellFixture.js';
async function signedRequest(payload, key = apiKey) {
  const raw = JSON.stringify(payload, null, 2);
  return new Request('https://fixture.invalid/retell-webhook', {
    method: 'POST', headers: { 'x-retell-signature': await Retell.sign(raw, key) }, body: raw,
  });
}

test('webhook authenticates exact raw JSON using the actual supported Retell SDK', async () => {
  let calls = 0;
  const handler = createRetellHandler({ apiKey, allowedAgentIds: ['agent_crt_test'], verify: Retell.verify,
    processCall: async call => { calls++; assert.equal(call.call_id, 'call_fixture'); return { data: { processing_status: 'processed', inspection_request_id: 'fixture-id' } }; },
  });
  const payload = { event: 'call_analyzed', call: analyzedCall() };
  assert.equal((await handler(await signedRequest(payload))).status, 200);
  assert.equal(calls, 1);
  assert.equal((await handler(await signedRequest(payload, 'wrong-key'))).status, 401);
  const raw = JSON.stringify(payload);
  const signature = await Retell.sign(raw, apiKey);
  assert.equal((await handler(new Request('https://fixture.invalid', { method: 'POST', body: raw + ' ', headers: { 'x-retell-signature': signature } }))).status, 401);
  const timestamp = Date.now() - 600000;
  const stale = `v=${timestamp},d=${createHmac('sha256', apiKey).update(raw + timestamp).digest('hex')}`;
  assert.equal((await handler(new Request('https://fixture.invalid', { method: 'POST', body: raw, headers: { 'x-retell-signature': stale } }))).status, 401);
  assert.equal(calls, 1, 'invalid or stale signatures never reach the database');
});

test('HTTP gates reject wrong agents and ignore other lifecycle/direction/transport events', async () => {
  let calls = 0;
  const handler = createRetellHandler({ apiKey, allowedAgentIds: ['agent_crt_test'], verify: Retell.verify,
    processCall: async () => { calls++; return { data: { processing_status: 'ignored' } }; },
  });
  assert.equal((await handler(new Request('https://fixture.invalid'))).status, 405);
  assert.equal((await handler(new Request('https://fixture.invalid', { method: 'POST', body: '{}' }))).status, 401);
  for (const event of ['call_started', 'call_ended', 'chat_analyzed']) {
    assert.equal((await handler(await signedRequest({ event, call: analyzedCall() }))).status, 200);
  }
  for (const changes of [{ direction: 'outbound' }, { call_type: 'web_call' }]) {
    assert.equal((await handler(await signedRequest({ event: 'call_analyzed', call: { ...analyzedCall(), ...changes } }))).status, 200);
  }
  assert.equal((await handler(await signedRequest({ event: 'call_analyzed', call: { ...analyzedCall(), agent_id: 'other-agent' } }))).status, 403);
  assert.equal(calls, 0);
  const payload = { event: 'call_analyzed', call: analyzedCall('call_other', { call_type: 'Existing Job' }) };
  assert.equal((await handler(await signedRequest(payload))).status, 200);
  assert.equal(calls, 1, 'valid other classifications reach the durable ignored ledger');
});

test('HTTP responses never acknowledge unconfirmed writes, expose database errors or retain unneeded call media', async () => {
  for (const result of [{ error: new Error('private customer detail') }, { data: null }, { data: { processing_status: 'failed', error_details: 'private customer detail' } }]) {
    const handler = createRetellHandler({ apiKey, allowedAgentIds: ['agent_crt_test'], verify: Retell.verify, processCall: async () => result });
    const response = await handler(await signedRequest({ event: 'call_analyzed', call: analyzedCall() }));
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes('private customer detail'), false);
  }
  const needsReview = createRetellHandler({ apiKey, allowedAgentIds: ['agent_crt_test'], verify: Retell.verify,
    processCall: async () => ({ data: { processing_status: 'needs_review' } }),
  });
  assert.equal((await needsReview(await signedRequest({ event: 'call_analyzed', call: analyzedCall() }))).status, 200);
  const selected = selectRetellCall({ ...analyzedCall(), transcript: 'private transcript', recording_url: 'secret', metadata: { secret: true } });
  assert.equal(selected.transcript, undefined); assert.equal(selected.recording_url, undefined); assert.equal(selected.metadata, undefined);
  assert.equal(selected.call_analysis.custom_analysis_data.roofing_work_requested, 'Reroof');
});

test('missing configuration, malformed JSON/ID and oversized requests fail safely', async () => {
  const base = { apiKey, allowedAgentIds: ['agent_crt_test'], verify: Retell.verify, processCall: async () => { throw new Error('must not be called'); } };
  for (const missing of [{ apiKey: '' }, { allowedAgentIds: [] }]) {
    const response = await createRetellHandler({ ...base, ...missing })(await signedRequest({}));
    assert.equal(response.status, 503);
  }
  const handler = createRetellHandler(base);
  assert.equal((await handler(new Request('https://fixture.invalid', { method: 'POST', body: '{', headers: { 'x-retell-signature': await Retell.sign('{', apiKey) } }))).status, 400);
  assert.equal((await handler(await signedRequest({ event: 'call_analyzed', call: { ...analyzedCall(), call_id: '' } }))).status, 400);
  const body = 'x'.repeat(2 * 1024 * 1024 + 1);
  assert.equal((await handler(new Request('https://fixture.invalid', { method: 'POST', body, headers: { 'x-retell-signature': 'fake' } }))).status, 413);
});
