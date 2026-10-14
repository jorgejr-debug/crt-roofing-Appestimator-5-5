// Run explicitly against a confirmed project AFTER its intake migration.
// Uses Admin Auth API; never creates an employee password or sends an invitation.
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
if (process.env.CONFIRM_AI_PHONE_PROJECT_URL !== url) throw new Error('Set CONFIRM_AI_PHONE_PROJECT_URL to the intended SUPABASE_URL');
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const email = 'ai-phone@automation.crtroofing.invalid';
const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };

const existing = check(await admin.from('phone_intake_identity').select('user_id').eq('provider', 'retell').maybeSingle());
let user;
if (existing) {
  ({ user } = check(await admin.auth.admin.getUserById(existing.user_id)));
  if (user?.email !== email) throw new Error('Configured identity is not the reserved AI Phone account; inspect manually');
} else {
  // Recover a previously interrupted provisioning operation without creating a duplicate.
  for (let page = 1; ; page++) {
    const { users } = check(await admin.auth.admin.listUsers({ page, perPage: 100 }));
    user = users.find(candidate => candidate.email === email);
    if (user || users.length < 100) break;
  }
  if (!user) ({ user } = check(await admin.auth.admin.createUser({
    email, email_confirm: true, password: randomBytes(48).toString('base64url'),
    ban_duration: '876000h', user_metadata: { full_name: 'AI Phone' },
    app_metadata: { automation_provider: 'retell' },
  })));
}
if (!user || user.app_metadata?.automation_provider !== 'retell') throw new Error('Reserved email belongs to an unrecognized account; inspect manually');
check(await admin.auth.admin.updateUserById(user.id, { ban_duration: '876000h' }));
const profile = check(await admin.from('user_profiles').select('email,full_name,role').eq('id', user.id).maybeSingle());
if (profile) {
  if (profile.email !== email || profile.full_name !== 'AI Phone' || profile.role !== 'salesperson') {
    throw new Error('Existing AI Phone profile differs from the expected non-admin profile; inspect manually');
  }
} else {
  check(await admin.from('user_profiles').insert({ id: user.id, email, full_name: 'AI Phone', role: 'salesperson' }));
}
if (!existing) check(await admin.from('phone_intake_identity').insert({ provider: 'retell', user_id: user.id }));
console.log('AI Phone identity is provisioned and sign-in disabled for', new URL(url).host);
