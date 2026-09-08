import { useCallback, useEffect, useMemo, useState } from "react";

const blankEntry = { entryId: "", websiteName: "", websiteUrl: "", category: "Other", username: "", password: "", secretNotes: "" };

export default function AccountAccessVault({ supabase, onClose }) {
  const [state, setState] = useState(null);
  const [reason, setReason] = useState("");
  const [itemReasons, setItemReasons] = useState({});
  const [entryDraft, setEntryDraft] = useState(blankEntry);
  const [revealed, setRevealed] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const invoke = useCallback(async (action, values = {}) => {
    const { data, error: invokeError } = await supabase.functions.invoke("account-access-vault", { body: { action, ...values } });
    if (invokeError || data?.error) throw new Error(data?.error || invokeError?.message || "Account access request failed");
    return data;
  }, [supabase]);

  const refresh = useCallback(async () => {
    const data = await invoke("status");
    setState(data);
  }, [invoke]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      try {
        const data = await invoke("status");
        if (active) setState(data);
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    });
    return () => { active = false; };
  }, [invoke]);

  useEffect(() => {
    if (!revealed?.hideAt) return undefined;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((new Date(revealed.hideAt).getTime() - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) setRevealed(null);
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [revealed?.hideAt]);

  const run = async (action, values, successMessage) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await invoke(action, values);
      setMessage(successMessage);
      await refresh();
      return data;
    } catch (runError) {
      setError(runError.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const approvedItemRequests = useMemo(() => (state?.itemRequests || []).filter((request) => request.status === "approved"), [state]);
  const requestForEntry = (entryId) => approvedItemRequests.find((request) => request.vault_entry_id === entryId);

  const reveal = async (requestId) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await invoke("reveal", { requestId });
      setRevealed(data);
      setSeconds(60);
    } catch (revealError) {
      setError(revealError.message);
    } finally {
      setBusy(false);
    }
  };

  const saveEntry = async () => {
    const saved = await run("save_entry", entryDraft, entryDraft.entryId ? "Account record updated." : "Account record added securely.");
    if (saved) setEntryDraft(blankEntry);
  };

  return (
    <div className="appShell">
      <header className="hero">
        <div><p className="eyebrow">Administration</p><h1>Account Access</h1><p className="intro">Two approvals protect company website and account login information.</p></div>
        <button type="button" className="secondaryButton" onClick={onClose}>Back to dashboard</button>
      </header>
      <div className="summaryCard" style={{ marginBottom: 16 }}><strong>How access works</strong><p>First request temporary access to the account catalog. After approval by Jorge or Natalia, request the specific account you need. A different approver must approve each step; self-approval is blocked. Revealed information automatically hides after 60 seconds.</p></div>
      {error ? <div className="errorBanner">{error}</div> : null}
      {message ? <div className="successBanner">{message}</div> : null}

      {revealed ? <section className="panel" style={{ borderColor: "#e4b84c" }}><div className="cfoDetailHeader"><div><p className="eyebrow">Temporarily revealed · {seconds}s</p><h2>{revealed.websiteName}</h2></div><button type="button" className="secondaryButton" onClick={() => setRevealed(null)}>Hide now</button></div><div className="detailList"><div><span>Username</span><strong>{revealed.secret?.username}</strong></div><div><span>Password</span><strong>{revealed.secret?.password}</strong></div><div><span>Website</span><strong>{revealed.websiteUrl || "Not provided"}</strong></div><div><span>Secure notes</span><strong>{revealed.secret?.notes || "None"}</strong></div></div></section> : null}

      {!state ? <section className="panel"><p>Loading secure access status…</p></section> : <>
        {!state.catalog ? <section className="panel"><h2>Step 1 — Request account catalog</h2><p>Tell Jorge or Natalia why you need access. Account names remain hidden until this request is approved.</p><label className="field"><span>Business reason</span><textarea rows="3" value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="actionRow" style={{ marginTop: 12 }}><button type="button" className="primaryButton" disabled={busy || state.catalogRequest?.status === "pending"} onClick={() => run("request_catalog", { reason }, "Catalog request sent to Jorge and Natalia.")}>{state.catalogRequest?.status === "pending" ? "Approval pending" : "Request Catalog Access"}</button></div></section> : <section className="panel"><h2>Step 2 — Request a specific account</h2><p>Your catalog approval expires {new Date(state.catalog.expires_at).toLocaleString()}. Passwords remain hidden until separately approved.</p><div className="savedList">{state.entries?.length ? state.entries.map((entry) => { const approved = requestForEntry(entry.id); const latest = (state.itemRequests || []).find((request) => request.vault_entry_id === entry.id); return <div className="savedCard" key={entry.id}><div><span className="eyebrow">{entry.category}</span><strong>{entry.website_name}</strong><p>{entry.website_url || "Website address available after approval"}</p>{!approved ? <input value={itemReasons[entry.id] || ""} onChange={(event) => setItemReasons((current) => ({ ...current, [entry.id]: event.target.value }))} placeholder="Why do you need this account?" /> : null}</div><div className="savedActions">{approved ? <button type="button" className="primaryButton" disabled={busy} onClick={() => reveal(approved.id)}>Reveal for 60 seconds</button> : latest?.status === "pending" ? <span className="statusTag">Approval pending</span> : <button type="button" className="secondaryButton" disabled={busy} onClick={() => run("request_item", { entryId: entry.id, reason: itemReasons[entry.id] || "" }, `Access request sent for ${entry.website_name}.`)}>Request This Account</button>}</div></div>; }) : <p className="emptyState">No account records are available.</p>}</div></section>}

        {state.profile?.isApprover ? <section className="panel"><h2>Approval requests</h2><p>Approvers cannot approve their own requests.</p><div className="savedList">{state.approvals?.length ? state.approvals.map((request) => <div className="savedCard" key={request.id}><div><span className="eyebrow">{request.request_type === "catalog" ? "Catalog access" : "Specific account"}</span><strong>{request.requester?.full_name || request.requester?.email}</strong><p>{request.entry?.website_name ? `${request.entry.website_name} · ` : ""}{request.reason}</p></div><div className="savedActions"><button type="button" className="primaryButton" disabled={busy} onClick={() => run("decide", { requestId: request.id, decision: "approved" }, "Access approved.")}>Approve</button><button type="button" className="dangerButton" disabled={busy} onClick={() => run("decide", { requestId: request.id, decision: "denied" }, "Access denied.")}>Deny</button></div></div>) : <p className="emptyState">No requests are waiting for approval.</p>}</div></section> : null}

        {state.profile?.isApprover ? <section className="panel"><h2>Manage account records</h2><p>Passwords are encrypted before being stored and never appear in the account catalog.</p><div className="formGrid"><label className="field"><span>Website / account name</span><input value={entryDraft.websiteName} onChange={(event) => setEntryDraft((current) => ({ ...current, websiteName: event.target.value }))} /></label><label className="field"><span>Website URL</span><input value={entryDraft.websiteUrl} onChange={(event) => setEntryDraft((current) => ({ ...current, websiteUrl: event.target.value }))} /></label><label className="field"><span>Category</span><input value={entryDraft.category} onChange={(event) => setEntryDraft((current) => ({ ...current, category: event.target.value }))} /></label><label className="field"><span>Username</span><input autoComplete="off" value={entryDraft.username} onChange={(event) => setEntryDraft((current) => ({ ...current, username: event.target.value }))} /></label><label className="field"><span>Password</span><input type="password" autoComplete="new-password" value={entryDraft.password} onChange={(event) => setEntryDraft((current) => ({ ...current, password: event.target.value }))} /></label><label className="field"><span>Secure notes</span><textarea value={entryDraft.secretNotes} onChange={(event) => setEntryDraft((current) => ({ ...current, secretNotes: event.target.value }))} /></label></div><div className="actionRow" style={{ marginTop: 12 }}><button type="button" className="primaryButton" disabled={busy} onClick={saveEntry}>Save Secure Account</button></div><div className="savedList" style={{ marginTop: 16 }}>{state.managedEntries?.map((entry) => <div className="savedCard" key={entry.id}><div><span className="eyebrow">{entry.category}</span><strong>{entry.website_name}</strong><p>{entry.website_url || "No URL"}</p></div><button type="button" className="secondaryButton" onClick={() => setEntryDraft({ ...blankEntry, entryId: entry.id, websiteName: entry.website_name, websiteUrl: entry.website_url, category: entry.category })}>Replace Login</button></div>)}</div></section> : null}
      </>}
    </div>
  );
}
