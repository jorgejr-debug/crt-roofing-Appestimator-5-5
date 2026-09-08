import { authenticateFinanceRequest, corsHeaders, hmacHex, jsonResponse, randomToken } from "../_shared/liquid-cash.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const access = await authenticateFinanceRequest(request);
  if (access.error) return access.error;
  const { admin, configuration, user } = access;
  const body = await request.json().catch(() => ({}));
  const challengeId = String(body?.challengeId || "").trim();
  const code = String(body?.code || "").trim();
  if (!/^[0-9]{4}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(challengeId)) {
    return jsonResponse({ error: "Enter the 4-digit code from your email" }, 400);
  }

  const token = randomToken();
  const codeHash = await hmacHex(`${challengeId}:${code}`, configuration.pepper);
  const tokenHash = await hmacHex(`reveal:${token}`, configuration.pepper);
  const { data, error } = await admin.rpc("verify_liquid_cash_challenge", {
    p_challenge_id: challengeId,
    p_user_id: user.id,
    p_code_hash: codeHash,
    p_reveal_token_hash: tokenHash,
  });
  if (error) return jsonResponse({ error: "Verification could not be completed" }, 500);
  const result = Array.isArray(data) ? data[0] : data;
  const outcome = String(result?.outcome || "invalid");
  if (outcome !== "success") {
    const status = outcome === "invalid" ? 404 : outcome === "failed" ? 401 : 410;
    const messages: Record<string, string> = {
      invalid: "That verification request was not found",
      failed: "That code is incorrect",
      expired: "That code has expired. Request a new one.",
      exhausted: "Too many incorrect attempts. Request a new code.",
      already_used: "That code has already been used. Request a new one.",
      superseded: "A newer code was requested. Use the newest email.",
      email_failed: "That code could not be delivered. Request a new one.",
    };
    return jsonResponse({ error: messages[outcome] || "Verification failed", outcome, attemptsRemaining: Number(result?.attempts_remaining || 0) }, status);
  }
  return jsonResponse({
    revealToken: token,
    revealSessionId: result?.reveal_session_id,
    expiresAt: result?.reveal_expires_at,
  });
});

