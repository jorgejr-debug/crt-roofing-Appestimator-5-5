import { useEffect, useRef, useState } from "react";
import "./CustomerProposalSigning.css";

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");

export default function CustomerProposalSigning({ token, kind = "proposal" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [record, setRecord] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [approvedIds, setApprovedIds] = useState([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(true);
  const endpoint = `${SUPABASE_URL}/functions/v1/execute-proposal?token=${encodeURIComponent(token)}&kind=${encodeURIComponent(kind)}`;

  useEffect(() => {
    fetch(endpoint, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to load proposal"); return body; })
      .then(setRecord).catch((loadError) => setError(loadError.message)).finally(() => setBusy(false));
  }, [endpoint]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || kind !== "proposal" && kind !== "change-order") return;
    const context = canvas.getContext("2d"); context.lineWidth = 3; context.lineCap = "round"; context.strokeStyle = "#102536";
    const position = (event) => { const box = canvas.getBoundingClientRect(); const point = event.touches?.[0] || event; return { x: (point.clientX - box.left) * canvas.width / box.width, y: (point.clientY - box.top) * canvas.height / box.height }; };
    const start = (event) => { event.preventDefault(); drawing.current = true; const point = position(event); context.beginPath(); context.moveTo(point.x, point.y); };
    const move = (event) => { if (!drawing.current) return; event.preventDefault(); const point = position(event); context.lineTo(point.x, point.y); context.stroke(); };
    const stop = () => { drawing.current = false; };
    canvas.addEventListener("pointerdown", start); canvas.addEventListener("pointermove", move); window.addEventListener("pointerup", stop);
    return () => { canvas.removeEventListener("pointerdown", start); canvas.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
  }, [kind, record]);

  const submit = async (decision) => {
    setBusy(true); setError("");
    try {
      const body = { decision, customerName, approvedSectionIds: approvedIds, signatureDataUrl: decision === "signed" ? canvasRef.current?.toDataURL("image/png") : "" };
      const response = await fetch(endpoint, { method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to record decision"); setDone(true);
    } catch (submitError) { setError(submitError.message); } finally { setBusy(false); }
  };

  if (busy && !record) return <main className="customerSigning"><section><h1>Loading secure proposal…</h1></section></main>;
  if (error && !record) return <main className="customerSigning"><section><h1>Signing link unavailable</h1><p>{error}</p></section></main>;
  if (done) return <main className="customerSigning"><section><h1>Thank you</h1><p>Your decision was securely recorded with CRT Roofing.</p></section></main>;

  const sections = record?.version?.sections || [];
  return <main className="customerSigning"><section>
    <p className="signingEyebrow">CRT Roofing · Secure execution</p>
    <h1>{kind === "change-order" ? "Change Order Approval" : `Proposal PR-${record?.proposalRequest?.request_number || ""}`}</h1>
    {kind === "proposal" ? <p>{record?.proposalRequest?.property_name}<br />{record?.proposalRequest?.service_address}</p> : <><h2>{record?.changeOrder?.description}</h2><p>{record?.changeOrder?.scope}</p><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(record?.changeOrder?.price || 0)}</strong></>}
    {kind === "proposal" ? <div className="signingSections">{sections.map((section) => <label key={section.id}><input type="checkbox" checked={approvedIds.includes(section.id)} onChange={(event) => setApprovedIds((current) => event.target.checked ? [...current, section.id] : current.filter((id) => id !== section.id))} /><span><strong>{section.title}</strong><small>{section.scope}</small></span></label>)}</div> : null}
    <label className="signingName"><span>Customer name</span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
    <div className="signatureBox"><span>Draw signature below</span><canvas ref={canvasRef} width="900" height="240" /><button type="button" onClick={() => canvasRef.current?.getContext("2d")?.clearRect(0, 0, 900, 240)}>Clear signature</button></div>
    {error ? <p className="signingError">{error}</p> : null}
    <div className="signingActions"><button type="button" className="signingDecline" disabled={busy || kind === "change-order"} onClick={() => submit("declined")}>Decline</button><button type="button" className="signingApprove" disabled={busy || !customerName || (kind === "proposal" && !approvedIds.length)} onClick={() => submit("signed")}>Approve selected scope &amp; sign</button></div>
    <small>This link is single-use and expires automatically. Your approved sections and signature timestamp become the authorization record for production.</small>
  </section></main>;
}

