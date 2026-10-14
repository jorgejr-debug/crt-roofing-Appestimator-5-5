import { useEffect, useState } from 'react';

export function SignedProposalUpload({ supabase, userId, source, onDone, onCancel }) {
  const [file, setFile] = useState(null), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const upload = async () => {
    if (!file || !confirmed || busy) return;
    setBusy(true); setError('');
    try {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 15 * 1024 * 1024) throw new Error('Choose a PDF, JPG or PNG up to 15 MB.');
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error('Your sign-in could not be verified. Please sign in again before uploading.');
      const path = `${userId}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      const result = await supabase.storage.from('signed-proposals').upload(path, file, { upsert: false });
      if (result.error) throw result.error;
      const saved = await supabase.rpc('register_signed_proposal', { p_source: source, p_path: path, p_name: file.name, p_confirmed: confirmed });
      if (saved.error) throw saved.error;
      onDone(saved.data);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <section role="dialog" aria-modal="true" aria-labelledby="signed-proposal-heading" className="panel" style={{ position: 'fixed', inset: '10% 10% auto', zIndex: 10000, background: 'var(--panel-bg, #fff)', color: '#152a38', padding: 24, boxShadow: '0 0 0 100vmax #0009', maxHeight: '80vh', overflow: 'auto' }}>
    <h2 id="signed-proposal-heading">Signed customer proposal required</h2>
    <p>Upload the signed proposal received by email. Miguel will receive a private link when the job is saved as approved.</p>
    <label>Signed proposal (PDF, JPG or PNG, up to 15 MB)<input type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setConfirmed(false); }} /></label>
    <label style={{ display: 'block', margin: '16px 0' }}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /> I checked the customer signature, scope and agreed price on this document.</label>
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy || !file || !confirmed} onClick={() => void upload()}>{busy ? 'Uploading…' : 'Upload and continue approval'}</button>{' '}
    <button type="button" disabled={busy} onClick={onCancel}>Cancel approval</button>
  </section>;
}

export default function SignedProposalHandoff({ supabase, user, source, documentId, onUpload }) {
  const [refresh, setRefresh] = useState(0);
  const [record, setRecord] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [opened, setOpened] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const query = supabase.from('signed_proposal_handoffs').select('*');
      const { data, error } = await (documentId ? query.eq('id', documentId) : query.eq('source_record_uid', source)).maybeSingle();
      if (alive) { setOpened(false); setRecord(data); setError(error?.message || (documentId && !data ? 'This document was not found or your account does not have access.' : '')); }
    };
    void load();
    return () => { alive = false; };
  }, [supabase, source, documentId, refresh]);
  const open = async () => {
    setBusy(true); setError('');
    // Open synchronously so browsers do not block the document after the secure URL request.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const { data, error } = await supabase.storage.from('signed-proposals').createSignedUrl(record.storage_path, 300);
      if (error) throw error;
      if (!tab) throw new Error('Allow pop-ups to open the signed proposal, then try again.');
      tab.location.href = data.signedUrl; setOpened(true);
    } catch (e) { tab?.close(); setError(e.message); } finally { setBusy(false); }
  };
  const acknowledge = async () => {
    setBusy(true); setError('');
    try {
      const { error } = await supabase.rpc('acknowledge_signed_proposal', { p_id: record.id });
      if (error) throw error;
      const refreshed = await supabase.from('signed_proposal_handoffs').select('*').eq('id', record.id).single();
      if (refreshed.error) throw refreshed.error;
      setRecord(refreshed.data);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <section className="panel"><h2>Signed proposal handoff</h2><button type="button" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh receipt status</button>
    {error && <p role="alert">{error}</p>}
    {record ? <><p>{record.file_name}</p><button type="button" disabled={busy} onClick={() => void open()}>Open signed proposal</button>
      {record.acknowledged_at ? <p>Miguel acknowledged receipt on {new Date(record.acknowledged_at).toLocaleString()}.</p> : <p>Awaiting Miguel’s acknowledgment.</p>}
      {String(user?.email || '').toLowerCase() === 'miguel@crtroofing.com' && !record.acknowledged_at && <><p>Open and review the document, then confirm receipt.</p><button type="button" disabled={busy || !opened} onClick={() => void acknowledge()}>Received signed proposal</button></>}
    </> : !error && <><p>No signed proposal attached yet.</p>{onUpload && <button type="button" onClick={onUpload}>Upload signed proposal</button>}</>}
  </section>;
}
