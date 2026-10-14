import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProposalLink, readProposalLink } from '../supabase/functions/_shared/proposalLinks.js';
const id = '01234567-89ab-4cde-8fab-0123456789ab';
test('comment email links round trip to the exact request and discussion', () => {
 const url = new URL(buildProposalLink('https://crt-roofing-estimator.vercel.app/?signedProposal=old#dashboard', id, true));
 assert.equal(url.origin, 'https://crt-roofing-estimator.vercel.app');
 assert.deepEqual(readProposalLink(url.search), { id, discussion: true });
 assert.equal(url.searchParams.has('signedProposal'), false);
 assert.equal(url.hash, '');
});
test('non-comment updates open request details without stale discussion navigation', () => {
 const url = new URL(buildProposalLink('https://example.com/?section=discussion', id));
 assert.deepEqual(readProposalLink(url.search), { id, discussion: false });
});
test('invalid IDs never select a request', () => {
 for (const search of ['', '?proposalRequest=28', '?proposalRequest=javascript:alert(1)']) assert.equal(readProposalLink(search), null);
 assert.throws(() => buildProposalLink('https://example.com', '../other'), /Invalid/);
});
