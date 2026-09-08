import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export function getServerConfiguration() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pepper = Deno.env.get("LIQUID_CASH_CODE_PEPPER");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !pepper) return null;
  return { supabaseUrl, anonKey, serviceRoleKey, pepper };
}

export async function authenticateFinanceRequest(request: Request) {
  const configuration = getServerConfiguration();
  if (!configuration) {
    return { error: jsonResponse({ error: "Liquid-cash access is not configured" }, 500) };
  }
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Authentication required" }, 401) };
  }
  const userClient = createClient(configuration.supabaseUrl, configuration.anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return { error: jsonResponse({ error: "Authentication required" }, 401) };
  }
  const admin = createClient(configuration.supabaseUrl, configuration.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: allowed, error: allowedError } = await admin.rpc("is_liquid_cash_access_user", {
    p_user_id: userData.user.id,
  });
  if (allowedError || allowed !== true) {
    await admin.from("liquid_cash_audit_events").insert({
      user_id: userData.user.id,
      event_type: "request_denied",
      metadata: { reason: "role" },
    });
    return { error: jsonResponse({ error: "Only CFO and admin users can access liquid cash" }, 403) };
  }
  return { configuration, admin, user: userData.user };
}

export async function hmacHex(value: string, pepper: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomDigits(length = 4) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => String(value % 10)).join("");
}

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function maskEmail(email: string) {
  const [local = "", domain = ""] = String(email || "").split("@");
  if (!domain) return "your verified email";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

