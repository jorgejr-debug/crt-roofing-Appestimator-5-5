# Message routing addition — prepared locally, not deployed

Requested October 2, 2026: general messages to Natalia, contract questions to Daniela. New estimates continue to Ivan. A Contract Question route takes precedence if an analysis also labels the call New Estimate. No existing calls are replayed or corrected by this migration.

The new message_route selector accepts General Message or Contract Question; leave empty for ordinary new estimates. Contract questions concern contract terms, signing, amendments, cancellation or contractual obligations. Mentioning a contract incidentally does not establish a contract question; ordinary billing/payment status messages go to Natalia. Classify the actual request, preserve negation, and do not infer from examples or the agent's statements. Explicit contract questions take precedence for mixed calls. Include all caller requests in reason_for_call so the recipient can coordinate follow-up.

Non-estimate calls without a valid route or message are retained as needs_review. Message tasks may retain missing contact fields as Not provided, without guessing or creating customer/inspection records. Existing employee requests remain caller preferences in the task sent to Natalia, except contract questions sent to Daniela. The fixed server-side recipient emails cannot be overridden by the caller.

Deployment sequence:
1. Run docs/retell-message-routing-preflight.sql in production and inspect compatibility and exactly one profile per recipient. Prefer staging deployment/test first.
2. Apply only supabase/migrations/20261002150000_retell_message_routing.sql; do not replay historical migrations or use broad db push.
3. Deploy the updated retell-webhook to the intended project. It now preserves message_route.
4. Add message_route to the production Retell draft, publish a named version and assign that version to the direct test number. Keep Verizon forwarding deactivated.
5. Test a general message and a contract question. Verify the receipt's task_id, exact assignee, AI Phone creator, one notification, no added inspection/lead, and visibility for Natalia/Daniela. Test ordinary new estimates again after the routing selector change.

The database locks each call ID and retains original data for retries. A processed outcome has exactly one inspection or standalone task. Existing task assignment notification triggers are reused; queued notifications do not prove inbox delivery. Missing/ambiguous recipient profiles fail safely without creating partial tasks. Failed transactions are retryable; needs_review requires office review.

Local verification: node --test tests/retellMessageRouting.test.js tests/retellIntakeDatabase.test.js tests/retellWebhook.test.js. Includes recipient routing, contract precedence, estimate regression, duplicate replay, notification creation, missing route, malformed fields, missing recipient recovery, rollback and access permissions. Fixture-backed tests do not establish deployed production compatibility.
