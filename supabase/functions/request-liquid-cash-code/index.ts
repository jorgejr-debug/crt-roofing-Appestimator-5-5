import { authenticateFinanceRequest, corsHeaders, hmacHex, jsonHeaders, jsonResponse, maskEmail, randomDigits } from "../_shared/liquid-cash.ts";

function escapeHtml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const access = await authenticateFinanceRequest(request);
  if (access.error) return access.error;
  const { admin, configuration, user } = access;
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return jsonResponse({ error: "Your account does not have a verified email address" }, 422);

  const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
  const { data: recent } = await admin
    .from("liquid_cash_access_challenges")
    .select("id, created_at")
    .eq("user_id", user.id)
    .gte("created_at", thirtySecondsAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) return jsonResponse({ error: "Please wait 30 seconds before requesting another code" }, 429);

  const now = new Date();
  await admin
    .from("liquid_cash_access_challenges")
    .update({ status: "expired" })
    .eq("user_id", user.id)
    .eq("status", "pending")
    .lte("expires_at", now.toISOString());
  await admin
    .from("liquid_cash_access_challenges")
    .update({ status: "superseded" })
    .eq("user_id", user.id)
    .eq("status", "pending");

  const challengeId = crypto.randomUUID();
  const code = randomDigits(4);
  const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
  const codeHash = await hmacHex(`${challengeId}:${code}`, configuration.pepper);
  const { error: insertError } = await admin.from("liquid_cash_access_challenges").insert({
    id: challengeId,
    user_id: user.id,
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
    attempt_count: 0,
    max_attempts: 5,
    status: "pending",
  });
  if (insertError) return jsonResponse({ error: "Could not create a verification challenge" }, 500);

  await admin.from("liquid_cash_audit_events").insert({
    user_id: user.id,
    challenge_id: challengeId,
    event_type: "code_requested",
    metadata: { expires_at: expiresAt },
  });

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("LIQUID_CASH_FROM_EMAIL") || Deno.env.get("TASK_NOTIFICATION_FROM_EMAIL");
  if (!resendApiKey || !fromEmail) {
    await admin.from("liquid_cash_access_challenges").update({ status: "email_failed" }).eq("id", challengeId);
    await admin.from("liquid_cash_audit_events").insert({ user_id: user.id, challenge_id: challengeId, event_type: "email_failed", metadata: { reason: "configuration" } });
    return jsonResponse({ error: "Email delivery is not configured" }, 500);
  }

  const html = `<div style="font-family:Arial,sans-serif;color:#102536;line-height:1.5;max-width:560px;margin:auto"><h1 style="font-size:24px">CRT Roofing liquid-cash code</h1><p>Use this code to reveal the liquid-cash balance:</p><div style="font-size:36px;font-weight:800;letter-spacing:12px;padding:18px 22px;border:1px solid #b9dcf5;border-radius:12px;background:#f6fbff;text-align:center">${escapeHtml(code)}</div><p>This code expires in 5 minutes and can be attempted at most 5 times. If you did not request it, do not share it.</p></div>`;
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: [email], subject: "Your CRT Roofing liquid-cash code", html }),
  });
  if (!resendResponse.ok) {
    const providerStatus = resendResponse.status;
    await resendResponse.text();
    await admin.from("liquid_cash_access_challenges").update({ status: "email_failed" }).eq("id", challengeId);
    await admin.from("liquid_cash_audit_events").insert({ user_id: user.id, challenge_id: challengeId, event_type: "email_failed", metadata: { provider_status: providerStatus } });
    return jsonResponse({ error: "The email provider rejected the message" }, 502);
  }

  await admin.from("liquid_cash_audit_events").insert({ user_id: user.id, challenge_id: challengeId, event_type: "email_sent", metadata: {} });
  return new Response(JSON.stringify({ challengeId, expiresAt, attemptsAllowed: 5, email: maskEmail(email) }), { headers: jsonHeaders });
});

