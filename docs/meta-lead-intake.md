# Meta lead intake

Implementation is staged, not deployed. Uses the existing CRM and its Send to Ivan action.
New leads start unqualified and assigned to the configured CFO/admin. They do not create
inspection tasks until reviewed through the existing handoff. Meta Ads is a CRM source filter.

## Deployment prerequisites

- This draft includes the committed live baseline from `feat/retell-phone-integration`,
  commit `27c5566957e44af2e082b6d921cb2d2ac2954b04`. Do not deploy older main
  over that baseline. Review the combined changes before any production deployment.
- Apply `20261014230000_meta_lead_intake.sql` to the app's Supabase project.
- Configure a Meta developer app with lead retrieval access for the CRT Page, the required
  Page subscription permissions/access level, and a supported Graph API version. Complete
  any Meta review/verification required for that app's production access.
- Set server-only secrets (never VITE variables or browser configuration):
  `META_APP_SECRET`, `META_VERIFY_TOKEN` (random), `META_PAGE_ACCESS_TOKEN`,
  `META_GRAPH_VERSION` (e.g. the version approved for your Meta app),
  `META_PAGE_ID`, `META_FORM_ID`, `META_PROPERTY_FIELD` (exact field_data key from the form),
  `META_INTAKE_OWNER_ID` (Jorge Jr's verified user_profiles UUID),
  `META_NOTIFICATION_FROM_EMAIL` (verified Resend sender), `META_APP_URL`, `RESEND_API_KEY`.
  Supabase supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
- Deploy `meta-lead-intake`; its JWT check is disabled because Meta uses HMAC authentication.
  Register `/functions/v1/meta-lead-intake` as the HTTPS callback and use META_VERIFY_TOKEN
  in the verification flow. Subscribe the app to the Page's `leadgen` events.
- Use the existing CRT Page and assessment form; do not create replacement ad accounts/forms.
  Confirm identifiers in Meta before setting secrets.

## Acceptance test before activation

1. Use Meta's Lead Ads Testing Tool with the configured Page/form and test contact data.
2. Confirm one CRM lead, Source Meta Ads, correct property type, assigned to Jorge Jr.
3. Confirm email arrives at that owner's profile email. Email contains an app link and reference,
   not customer contact data. Verify the configured sender and destination with an actual test.
4. Replay the same signed webhook: only one lead, with reviewed fields unchanged.
5. Use the existing CRM handoff after completing its required fields; verify Ivan's task.
6. Test retrieval/email failures: handler returns 503; replay after repair completes processing.

Receipts retain original form answers/ad ID independently of frontend saves. Deduplication
is by Meta lead ID, not phone (the same caller may have multiple buildings). All receipt
access and the ingestion RPC are restricted to service_role. The webhook verifies the raw
body signature and restricts intake to one Page/form. It never logs tokens or contact data.

## Operations and limitations

Email uses Resend's idempotency key plus a persisted sent timestamp. An ambiguous send followed
by a delayed retry beyond the provider's deduplication window can still duplicate an email;
the lead itself stays unique. Failed HTTP requests return non-2xx for retry, but this is not
a durable queue or scheduled reconciliation service. Monitor function failures and reconcile
Meta form downloads against receipts; manually replay missed events through Meta's tooling.
Do not assume retries continue indefinitely. If an owner/sender/token changes, test again.

No production credentials, Meta subscriptions, database changes, notifications, or ad publishing
are performed by committing this code. Automatic conversions feedback to Meta is not included.

Rollback: unsubscribe the Meta callback first; keep the receipt table/CRM rows for history.
