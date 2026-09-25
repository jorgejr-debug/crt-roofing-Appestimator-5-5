import { useCallback, useEffect, useRef, useState } from 'react';
import FileDropZone from './FileDropZone.jsx';
import { TASK_ATTACHMENT_BUCKET, TASK_ATTACHMENT_ACCEPT, createTaskUpload, saveTaskAttachment, validateTaskAttachment } from './taskAttachments.js';
export default function TaskAttachments({ supabase, taskId, userId }) {
  const [items, setItems] = useState([]), [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const locked = useRef(false);
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('company_task_attachments').select('*').eq('task_id', taskId).order('created_at');
    if (error) throw error; setItems(data || []);
  }, [supabase, taskId]);
  useEffect(() => { const timer = setTimeout(() => { void refresh().catch(error => setError(`Attachments could not load: ${error.message}`)); }, 0); return () => clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!pending.length && !busy) return;
    const guard = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [pending.length, busy]);
  const upload = async (entries) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    const failed = []; let saved = 0;
    try {
      for (const entry of entries) {
        try { await saveTaskAttachment(supabase, taskId, entry); saved++; }
        catch (error) { failed.push({ ...entry, error: error.message || 'Upload failed. Check your connection.' }); }
      }
      setPending(failed);
      setNotice(saved ? `${saved} attachment${saved === 1 ? '' : 's'} saved.` : '');
      if (failed.length) setError('Some files were not saved. Keep this task open and retry after reconnecting.');
      await refresh();
    } catch (error) { setError(`Could not refresh attachments: ${error.message}. Use Refresh attachments to check saved files.`); }
    finally { locked.current = false; setBusy(false); }
  };
  const choose = files => {
    const invalid = files.map(validateTaskAttachment).filter(Boolean);
    if (invalid.length) { setError(invalid.join(' ')); return; }
    const entries = [...pending, ...files.map(file => createTaskUpload(taskId, userId, file))];
    setPending(entries); void upload(entries);
  };
  const open = async item => {
    setError('');
    try {
      const { data, error } = await supabase.storage.from(TASK_ATTACHMENT_BUCKET).createSignedUrl(item.storage_path, 600, { download: item.file_name });
      if (error || !data?.signedUrl) throw error || new Error('Download link unavailable');
      // Same-tab download avoids popup blockers after the asynchronous request.
      const link = document.createElement('a'); link.href = data.signedUrl; link.download = item.file_name; link.click();
    } catch (error) { setError(`File could not open: ${error.message}`); }
  };
  return <section className="taskAttachments" aria-label="Task attachments">
    <h4>Photos &amp; attachments</h4>
    <FileDropZone accept={TASK_ATTACHMENT_ACCEPT} label="Add Photos & Files" help="Photos, PDFs, Word, Excel, CSV or text. Up to 25 MB per file. Only this task’s participants can open them." disabled={busy} onFiles={choose} />
    {busy ? <p role="status">Uploading attachments… Keep this task open.</p> : null}
    {error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    {pending.length ? <div>{pending.map(entry => <p key={entry.id}>{entry.file.name}{entry.error ? ` — ${entry.error}` : ''}</p>)}<button type="button" className="secondaryButton" disabled={busy} onClick={() => void upload(pending)}>Retry pending files</button><p>Unsaved files must be selected again if you leave this task.</p></div> : null}
    <div className="taskAttachmentList">{items.map(item => <button type="button" className="secondaryButton" key={item.id} onClick={() => void open(item)}>{item.file_name}</button>)}</div>
    {!items.length && !busy ? <p>No attachments saved yet.</p> : null}
    <button type="button" className="secondaryButton" disabled={busy} onClick={() => void refresh().catch(error => setError(error.message))}>Refresh attachments</button>
  </section>;
}
