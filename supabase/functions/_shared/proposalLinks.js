const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readProposalLink(search) {
  const params = new URLSearchParams(search);
  const id = params.get('proposalRequest') || '';
  return uuid.test(id) ? { id, discussion: params.get('section') === 'discussion' } : null;
}
export function buildProposalLink(appUrl, id, discussion = false) {
  if (!uuid.test(id)) throw new Error('Invalid proposal request ID');
  const url = new URL(appUrl);
  url.searchParams.set('proposalRequest', id);
  url.searchParams.delete('signedProposal');
  url.searchParams.delete('section');
  if (discussion) url.searchParams.set('section', 'discussion');
  url.hash = '';
  return url.toString();
}
