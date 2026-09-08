import { authenticateFinanceRequest, corsHeaders, hmacHex, jsonResponse } from "../_shared/liquid-cash.ts";

function asClientEntry(row: Record<string, unknown>) {
  return {
    id: String(row.source_record_uid || "cfo:liquid_cash").split(":").pop() || "liquid_cash",
    bankAccountName: String(row.bank_account_name || row.record_name || "Company liquid cash"),
    currentLiquidBalance: Number(row.amount || 0),
    lastUpdatedDate: String(row.record_date || ""),
    includedInTotal: row.included_in_total === false ? "No" : "Yes",
    rowVersion: Number(row.row_version || 1),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const access = await authenticateFinanceRequest(request);
  if (access.error) return access.error;
  const { admin, configuration, user } = access;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "reveal");
  const revealToken = String(body?.revealToken || "");
  if (!revealToken) return jsonResponse({ error: "A reveal session is required" }, 401);
  const tokenHash = await hmacHex(`reveal:${revealToken}`, configuration.pepper);
  const { data: session, error: sessionError } = await admin
    .from("liquid_cash_reveal_sessions")
    .select("id, challenge_id, user_id, expires_at, revealed_at, hidden_at")
    .eq("token_hash", tokenHash)
    .eq("user_id", user.id)
    .maybeSingle();
  if (sessionError || !session) return jsonResponse({ error: "Reveal session not found" }, 404);

  const expired = new Date(session.expires_at).getTime() <= Date.now();
  if (session.hidden_at || expired) {
    if (!session.hidden_at) {
      const hiddenAt = new Date().toISOString();
      await admin.from("liquid_cash_reveal_sessions").update({ hidden_at: hiddenAt, hide_reason: "expired" }).eq("id", session.id).is("hidden_at", null);
      await admin.from("liquid_cash_audit_events").insert({ user_id: user.id, challenge_id: session.challenge_id, reveal_session_id: session.id, event_type: "reveal_expired", metadata: { scheduled_expires_at: session.expires_at } });
    }
    return jsonResponse({ error: "The 60-second reveal has expired" }, 410);
  }

  if (action === "hide") {
    const hiddenAt = new Date().toISOString();
    await admin.from("liquid_cash_reveal_sessions").update({ hidden_at: hiddenAt, hide_reason: "hidden" }).eq("id", session.id).is("hidden_at", null);
    await admin.from("liquid_cash_audit_events").insert({ user_id: user.id, challenge_id: session.challenge_id, reveal_session_id: session.id, event_type: "reveal_hidden", metadata: {} });
    return jsonResponse({ ok: true });
  }

  if (action === "save") {
    const entry = body?.entry || {};
    const bankAccountName = String(entry.bankAccountName || "").trim();
    const amount = Number(String(entry.currentLiquidBalance ?? 0).replace(/[$,\s]/g, ""));
    const includedInTotal = String(entry.includedInTotal || "Yes").toLowerCase() !== "no";
    if (!bankAccountName || !Number.isFinite(amount) || amount < 0) return jsonResponse({ error: "Enter a valid account name and non-negative balance" }, 422);
    const row = {
      source_record_uid: "cfo:liquid_cash",
      record_type: "liquid_cash",
      card_key: "liquid_cash",
      bank_account_name: bankAccountName,
      record_name: bankAccountName,
      amount,
      record_date: String(entry.lastUpdatedDate || new Date().toISOString().slice(0, 10)),
      included_in_total: includedInTotal,
      is_archived: false,
      updated_by: user.id,
    };
    const { data, error } = await admin.from("company_financial_records").upsert(row, { onConflict: "source_record_uid" }).select("*").single();
    if (error || !data) return jsonResponse({ error: "The liquid-cash balance could not be saved" }, 500);
    await admin.from("liquid_cash_audit_events").insert({ user_id: user.id, challenge_id: session.challenge_id, reveal_session_id: session.id, event_type: "balance_updated", metadata: { record_uid: "cfo:liquid_cash" } });
    return jsonResponse({ entries: [asClientEntry(data)], expiresAt: session.expires_at });
  }

  if (action === "archive") {
    const { error } = await admin.from("company_financial_records").update({ is_archived: true, updated_by: user.id }).eq("source_record_uid", "cfo:liquid_cash");
    if (error) return jsonResponse({ error: "The liquid-cash record could not be archived" }, 500);
    await admin.from("liquid_cash_audit_events").insert({ user_id: user.id, challenge_id: session.challenge_id, reveal_session_id: session.id, event_type: "balance_archived", metadata: { record_uid: "cfo:liquid_cash" } });
    return jsonResponse({ entries: [], expiresAt: session.expires_at });
  }

  const { data, error } = await admin
    .from("company_financial_records")
    .select("id, source_record_uid, record_type, card_key, bank_account_name, record_name, amount, record_date, included_in_total, row_version, updated_at")
    .eq("record_type", "liquid_cash")
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });
  if (error) return jsonResponse({ error: "The liquid-cash balance could not be loaded" }, 500);
  if (!session.revealed_at) {
    await admin.from("liquid_cash_reveal_sessions").update({ revealed_at: new Date().toISOString() }).eq("id", session.id).is("revealed_at", null);
    await admin.from("liquid_cash_audit_events").insert({ user_id: user.id, challenge_id: session.challenge_id, reveal_session_id: session.id, event_type: "balance_revealed", metadata: {} });
  }
  return jsonResponse({ entries: (data || []).map(asClientEntry), expiresAt: session.expires_at });
});

