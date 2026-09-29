import { createClient } from 'npm:@supabase/supabase-js@2.105.4';
import { Retell } from 'npm:retell-sdk@6.0.1';
import { createRetellHandler } from './handler.js';

const apiKey = Deno.env.get('RETELL_API_KEY');
const allowedAgentIds = (Deno.env.get('RETELL_ALLOWED_AGENT_IDS') || '')
  .split(',').map(value => value.trim()).filter(Boolean);
const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin = url && serviceKey ? createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
}) : null;

Deno.serve(createRetellHandler({
  apiKey,
  allowedAgentIds,
  verify: (body: string, key: string, signature: string) => Retell.verify(body, key, signature),
  processCall: (call: Record<string, unknown>) => admin
    ? admin.rpc('process_retell_call', { p_call: call })
    : Promise.resolve({ data: null, error: { message: 'Backend not configured' } }),
}));
