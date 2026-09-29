# Retell AI Phone → Inspection Requests

Implementation is local and tested. No migration, function, automation account,
Retell setting, or frontend deployment has been applied to production by this task.

## Endpoint and configuration

For the production Supabase project referenced by this app's existing configuration,
the endpoint **after deployment** is:

`https://vomgasmchiynffcyfirn.supabase.co/functions/v1/retell-webhook`

Verify that project against the intended environment before deploying. A staging
project has its own URL and must not use the production webhook for testing.

Configure in **Supabase → Edge Functions → Secrets** (not Vercel/frontend variables):

| Name | Value / purpose |
|---|---|
| `RETELL_API_KEY` | Retell API key used by its supported raw-body signature verifier. Enter through server secret management; never paste it into chat or commit it. |
| `RETELL_ALLOWED_AGENT_IDS` | Required exact Conversation Flow Agent ID, or comma-separated approved IDs. Empty configuration rejects requests. Use only a test agent in staging. |
| `SUPABASE_URL` | Supabase's built-in Edge Function environment value. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase's built-in server-only Edge Function value. Never expose through a `VITE_*` variable. |

No Retell key is needed in Vercel. The existing notification functions still need
their existing `RESEND_API_KEY`, `TASK_NOTIFICATION_WEBHOOK_SECRET`,
`TASK_NOTIFICATION_FROM_EMAIL` and `TASK_NOTIFICATION_APP_URL` configuration and
database webhook/scheduler wiring. This integration does not replace those paths.

Retell settings: select the approved Conversation Flow Agent, configure its webhook
URL, and subscribe to `call_analyzed` only. Check any existing webhook first:
Retell agent-level webhooks override the account-level webhook for that agent.
The handler independently ignores `call_started` and `call_ended`.

## Creation and mapping

The Edge Function verifies the `x-retell-signature` on the original raw UTF-8 body
using pinned `retell-sdk@6.0.1`, checks the agent allowlist, and accepts only inbound
`phone_call` calls. It selects only known metadata, the summary, and the configured
extraction fields; it does not store recordings, transcripts, arbitrary metadata,
or dynamic variables. The SDK also validates signature freshness.

Business classification is exactly
`call.call_analysis.custom_analysis_data.call_type === "New Estimate"`.
`call.call_type` is the transport type and is never used as the business category.

`process_retell_call` is callable only by `service_role`. It creates the receipt,
resolves Ivan uniquely by `lower(trim(user_profiles.email)) = 'ivan@crtroofing.com'`,
and calls the existing `save_inspection_request` and shared submission core.
Submission still creates the existing CRM link, private task, assignment,
inspection audit and task notification. It does not create another business workflow.

| Input | Destination |
|---|---|
| `caller_name` | `inspection_requests.contact_name` and linked CRM contact |
| `callback_number` | Inspection and CRM phone; no silent fallback to caller ID |
| `email_address` | Inspection and CRM email |
| `property_address` | Inspection and CRM address |
| `roofing_work_requested` | Labeled notes and CRM `service_needed`; existing `Roof inspection` default if absent |
| `property_type`, `reason_for_call` | Labeled notes |
| `requested_timing` | Labeled preference in notes, never an appointment or urgency inference |
| `requested_employee` | Labeled caller preference in notes; assignee remains Ivan |
| `urgency_status` | Existing urgency plus original wording in notes |
| `call.call_analysis.call_summary` | Labeled AI call summary in notes |
| Source | CRM `lead_source = 'AI Phone'`, plus inspection notes |
| `call.call_id` | Unique intake ledger ID and inspection notes |

Urgency mapping: `Active Leak / Water Intrusion` → `Urgent`;
`Other Urgent Condition` → `High`; `Routine / No Urgent Issue`, missing or unknown
values → `Normal`. ASAP alone does not raise urgency. Existing submission maps
both High and Urgent to high-priority tasks. New inspections have status `new`,
no appointment and no invented due date. Existing follow-up alerts continue to apply.

Manual submission remains `Phone Call / Office` / `Roof inspection`. The new
internal submission function accepts trusted source/service arguments but has no
execute grant for anonymous users, employees or the service role directly. The
existing public manual RPC remains its permission-checking entry point.

## Automation attribution

`phone_intake_identity` binds Retell to a dedicated provisioned Auth user/profile:

- Name: **AI Phone**
- Reserved non-deliverable email: `ai-phone@automation.crtroofing.invalid`
- Existing non-admin role: `salesperson`, to satisfy the current intake role model
- Sign-in banned for 100 years; random password is generated and never printed
- Admin-only app metadata marks the account as the Retell automation identity

The migration does not invent an Auth UUID or alter a human's profile. After the
migration, an operator runs the explicit provisioning script using server credentials:

```sh
# Supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY through a secure local/server
# environment, not command-line literals or a committed file.
export CONFIRM_AI_PHONE_PROJECT_URL="$SUPABASE_URL"
node scripts/provision-ai-phone.mjs
```

The script sends no invitation, never prints the random password/key, and supports
re-running after an interrupted provisioning operation. It refuses to repurpose
a mismatched existing account/profile. The intake validates the binding, reserved
profile and active sign-in ban each time.

The service-only database adapter sets the dedicated account's subject locally
for the transaction while invoking the existing auth-dependent RPCs/triggers.
It restores the original subject/claims on success and failure. No employee token
is minted and no human is impersonated. Creator/audit/assigned-by attribution is
AI Phone; Ivan is solely the assignee, so the existing self-assignment notification
suppression does not apply. The account should not be manually assigned work.

## Database changes and failure handling

Migration: `supabase/migrations/20260929120000_retell_phone_intake.sql`.

New tables:

1. `phone_intake_events`: provider, event type, external call ID, received/updated
   timestamps, processing status, selected `call_data` JSON, resulting inspection
   ID, attempts, error code and error details. Unique constraints cover both
   `(provider,event_type,external_call_id)` and `(provider,external_call_id)`;
   each resulting inspection ID is also unique.
2. `phone_intake_identity`: provider, provisioned automation user UUID, created time.

No columns are added to inspection, CRM, task, attachment or user-profile tables.
The event ledger is readable only by office managers (`admin`/`cfo`) under RLS,
and writable only by the backend. Identity configuration is backend-only.

Processing is serialized by a transaction advisory lock per call ID. An inner
transaction block creates all customer-workflow records together. If any step
fails, those writes roll back, while the outer receipt/error commits. Thus a
notification-trigger failure cannot leave half an inspection or CRM record.
Actual email sending remains asynchronous through the existing notification path.

Outcomes:

| Status | Behavior |
|---|---|
| `processed` | HTTP 200; retries return the original inspection ID without updating employee work or sending another assignment notification. |
| `ignored` | HTTP 200; valid non-estimate classifications are retained without creating work. Other lifecycle events/outbound calls are ignored at the HTTP gate without a receipt. |
| `needs_review` | HTTP 200 after durable recording; no fabricated name/contact. Includes missing classification, insufficient customer data, malformed extraction values or fields exceeding inspection limits. |
| `failed` | HTTP 503 after retaining the error; Retell can retry. Includes unresolved/ambiguous Ivan, missing automation setup or database workflow errors. |

The existing minimum is a caller name and at least one of callback number, email
or property address. Raw provided values remain in the restricted event record.
No other employee or requested employee is used as an assignment fallback.

Retries use the initially stored selected data. Later reanalysis of the same call
does not overwrite an existing inspection. A corrected needs-review record is an
explicit office/backend review operation, not an automatic retry of new values.

If the database is unavailable entirely, no durable receipt can be promised: the
handler returns 503. Retell retries are finite (currently up to three retries
with a 10-second response window), so failed deliveries still need operational
review. There is no new periodic retry worker or office-review UI in this scope.

Office/backend review query:

```sql
SELECT id, external_call_id, received_at, processing_status, attempts,
       inspection_request_id, error_code, error_details
FROM public.phone_intake_events
WHERE processing_status IN ('failed','needs_review')
ORDER BY received_at DESC;
```

After fixing an operational failure, a privileged operator can retry **stored** data:

```sql
SELECT public.process_retell_call(call_data)
FROM public.phone_intake_events
WHERE id = '<reviewed-event-uuid>' AND processing_status = 'failed';
```

Do not delete successful receipts, reset processed states, or replay production
calls against a different database to test duplicates. Those actions remove the
intended idempotency boundary. Preserve ledger records with their inspections.

## Deployment still required

1. Confirm the target project, reconcile remote migration history, and review the
   new migration against its current schema. Do not blindly apply unrelated local
   migrations. This implementation is based on the checked-in inspection/profile
   compatibility migrations, not a fresh live schema dump.
2. Apply the new migration to staging; provision AI Phone using the script above.
3. Configure `RETELL_API_KEY` and `RETELL_ALLOWED_AGENT_IDS` in staging server secrets.
4. Deploy `retell-webhook` with Supabase CLI to that project. The checked-in
   `supabase/config.toml` specifies `verify_jwt = false` for this function because
   it authenticates Retell signatures itself, not Supabase browser JWTs.
5. Verify existing assignment-email database webhook and workflow scheduler in
   staging; use a test mail destination/sink rather than real employee/customer mail.
6. Deploy the frontend to a preview pointed at staging for the urgent styling and
   `AI Phone` CRM source option.
7. After staging acceptance, repeat the specific migration/provision/secrets/function
   steps for production, publish the frontend through the existing Vercel process,
   and only then configure the live Retell webhook URL. No Vercel API route is needed.

Example function deployment command (replace the placeholder with the confirmed
staging or production project reference):

```sh
supabase functions deploy retell-webhook --project-ref <confirmed-project-ref>
```

## Safe end-to-end acceptance

Use a staging Supabase project and a separate Retell test Conversation Flow Agent
with the same extraction configuration. Use a test **inbound phone call**: Retell
web-call simulations are deliberately ignored by this integration. Do not point
the live agent at staging or use a real customer call as a test.

1. Confirm a staging Ivan profile exists at the expected email and use a mail sink.
2. Place a routine reroof test call with fictional details. Verify one event with
   `processed`, one New inspection requested by AI Phone/assigned to Ivan, one linked
   CRM record sourced AI Phone, one private task, and one assignment notification.
3. Verify the requester, notes, phone/email/address, call ID, summary and requested
   employee are preserved; appointment remains empty.
4. Replay the same analyzed event with a valid fresh Retell signature; verify all
   business record counts and the notification count remain unchanged. The raw
   JSON must be signed as sent; old signatures expire. Automated local tests use
   the supported SDK signer/verifier and require no real key.
5. Test active leak, other urgent condition, and routine + ASAP. Expect Urgent,
   High and Normal respectively. Confirm the red Urgent badge/border in queue/detail.
6. Test a call missing the caller's name/contact: review record only, no fake customer.
7. Open as staging Ivan, contact/schedule, enter findings and measurements, then
   use the existing proposal handoff. Verify Daniela's normal review gate.
8. Confirm actual assignment email arrival through the configured test mail route.
   Creating a pending notification in SQL does not prove an inbox received it.
9. Review Retell webhook delivery logs and the intake ledger before enabling real calls.

## Validation performed

- `npm test`: **344 tests passed**, including real PostgreSQL (PGlite) execution of
  the migration, existing task and notification functions, complete manual inspection
  lifecycle, AI intake → Ivan → Daniela handoff, and transaction rollback.
- Real Retell SDK verification tests cover raw whitespace, invalid keys/signatures,
  stale signatures, wrong agents, wrong event/transport/direction and malformed inputs.
- Eight concurrent HTTP handler invocations produce a single workflow. PGlite
  serializes SQL on one embedded connection; multi-connection PostgreSQL contention
  should additionally be exercised in staging. Database unique constraints and
  advisory locking are part of the production implementation.
- Production frontend build, targeted ESLint and Deno Edge Function type-check passed.
- Actual queue and detail components inspected in an isolated 1280px-wide browser:
  urgent red badge/border and requester/assignee rendering verified; no live backend.
- Production Retell signatures/agent configuration, live schema drift, actual email
  delivery and multi-connection deployment behavior remain staging acceptance checks.

Body limits: 2 MiB incoming JSON, 90 KB selected call data, and existing inspection
field limits. Oversized HTTP payloads return 413 without a receipt; check real Retell
payload sizes before enabling long calls. Only summary/extraction is retained after
verification. The existing Vite large-chunk build warning remains.

## Changed files

New:

- `supabase/functions/retell-webhook/index.ts`
- `supabase/functions/retell-webhook/handler.js`
- `supabase/migrations/20260929120000_retell_phone_intake.sql`
- `scripts/provision-ai-phone.mjs`
- `tests/inspectionDatabaseFixture.js`
- `tests/retellFixture.js`
- `tests/retellWebhook.test.js`
- `tests/retellIntakeDatabase.test.js`
- `docs/RETELL_PHONE_INTAKE.md`

Updated:

- `supabase/config.toml` — signature-authenticated webhook endpoint configuration
- `src/InspectionRequests.jsx`, `src/InspectionRequests.css` — urgent badge/border only
- `src/App.jsx` — AI Phone CRM source option
- `tests/inspectionCenterSecurity.test.js` — shared fixture; existing assertions retained
- `package.json`, `package-lock.json` — pinned test SDK as a development dependency;
  production Edge Function pins its own server-side import

Official protocol reference: https://docs.retellai.com/features/webhook-overview
and https://docs.retellai.com/features/post-call-analysis-consumption.
