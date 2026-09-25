# CRT Roofing workflow update — implementation and verification

## Status

Implemented and deployed from `jorgejr-debug/crt-roofing-Appestimator-5-5`, baseline commit `be9aee5` (Lazy load tile estimator). The ChatGPT project mirror had no app source. The repository was cloned into `crt-roofing-app`; synced reference files were not modified.

Production app: https://crt-roofing-estimator.vercel.app

Vercel production deployment: `dpl_E87Y2DansEJ1t7QPSWkoTYhChm1L` ([deployment details](https://vercel.com/jorgejr-8255s-projects/crt-roofing-estimator/E87Y2DansEJ1t7QPSWkoTYhChm1L)). Supabase project: `vomgasmchiynffcyfirn` / `crt-roofing-app-Reformed` (West US/Oregon). The production environment URL was verified to match this project. The prior deployment matched repository baseline `be9aee5`.

Three new migrations were validated against production in a transaction ending in ROLLBACK, then applied together in a committed transaction and recorded in `supabase_migrations.schema_migrations`. No historical migrations were replayed. No existing job, estimate, customer, employee, or financial records were rewritten. No synthetic customer/job/test records were created in production. Existing backups were visible (latest was about ten hours old at inspection).

The notification function is deployed through the dashboard, using an exact concatenation of the checked-in shared evaluator and handler (local import removed). Legacy JWT verification remains ON and the handler additionally checks the existing webhook secret. Vault holds the existing notification secret, endpoint, and existing public legacy anon gateway token; the notification secret was copied inside the database without being displayed. No API credentials were rotated.

Scheduling and delivery verification are recorded in the deployment results below. Authenticated read-only acceptance was performed after company sign-in; remaining write/device checks are listed below.

Source implementation commit: `6be51d0`. After the user authorized the pending merge, remote `main` was safely fast-forwarded from `be9aee5` to `7d76f3c` on September 25, 2026. The feature branch and production implementation are now included in the default branch. No force push or history rewrite was used. The earlier automatic approval block is resolved. The user subsequently signed in for the acceptance checks below.

## Implemented changes

### Active Job Issue & Escalation

- Replaced whole-job issue saves with `save_active_job_issue`, a transaction that locks the existing job, merges only the requested issue, and returns the confirmed server result.
- Requires an active employee owner and response deadline. Adds Critical severity. Critical/Emergency deadlines are capped at one hour from escalation; High/Critical/Emergency mark the job Critical. General job saves cannot erase issue records or downgrade an open serious issue's risk.
- Supports editing existing issues, explicit resolution confirmation with a correction note, reopening, actor/time metadata, and before/after audit snapshots. The audit table is read-only to authorized app users; writes are server-controlled.
- Uses request IDs for retry deduplication and optimistic concurrency for stale edits. An uncertain save retried with changed content is rejected rather than silently losing the edit.
- Queues notifications for existing Jorge (`jorgejr@crtroofing.com`) and Natalia (`natalia@crtroofing.com`) profiles and the owner's linked profile. Those addresses were already present in the repository; no accounts or contacts were created. A missing office profile blocks issue saving with a configuration error.
- Displays audit history and overdue deadlines. Stores issue drafts per signed-in user and job on the device. Existing issue history is retained as-is; no invented historical events are backfilled.

### Coating, Repair / Service, and Maintenance

- Replaced placeholders with a shared, lazy-loaded service estimator: job information, service scope, quantity/unit/price material lines, crew labor, travel, adjustable overhead, scope adders, miscellaneous costs, markup and bid totals.
- Reuses existing loaded-labor rules, travel calculator, markup options, save/load handlers, proposal builder, and PDF generator. Supplier prices are entered by users, not invented.
- Validation catches missing identity/scope and invalid negative/nonfinite cost inputs. Existing maintenance notes transfer into service scope.
- Service scope is included in proposal output. PDF exports include scope, material line details, and the common cost/markup summaries; long service scope is paginated.
- Uses existing estimator draft storage. This is manual quantity-based coating estimating; automatic manufacturer coverage/yield rules and prefilled product prices are not introduced.

### Performance

Extracted CFO, CRM, Active Jobs list, Active Job details, Field Operations, Approved Jobs list, Approved Job details, and Administration into separate lazy-loaded modules. Existing shared loading/error recovery remains in place. Calculations/state remain in App to limit behavioral changes. Removed the post-build JavaScript inlining step: moving the entry module into HTML broke relative imports of split chunks. The first preview exposed a blank page; the corrected preview and production login page both load normally with external hashed assets.

Baseline main chunk: **1,057.88 kB / 265.46 kB gzip**. Final measured main chunk is recorded below; **891.77 kB / 238.07 kB gzip**, a **15.7% uncompressed reduction**. The main chunk still exceeds Vite's 500 kB advisory threshold. Estimator calculation code and other state remain opportunities for later extraction.

### Production alerts and delivery

Added a recipient-restricted dashboard alert inbox, acknowledgment, a durable notification queue, and the `process-workflow-notifications` Edge Function. Delivery uses leased claims, bounded retries, provider idempotency keys, and error/status reporting. Existing queued issue notifications are processed even when a subsequent production scan fails. Source reads are isolated: a missing source cannot prevent unrelated alerts, and an unavailable log source cannot generate false missing-log alerts. A secret-protected dryRun request previews counts without queue writes or email sends.

Default rules (implementation choices to review with operations):

| Alert | Trigger | Audience |
| --- | --- | --- |
| Issue change / resolution | Successful issue transaction | Jorge, Natalia, linked owner |
| Open serious issue | High/Critical/Emergency remains open | Jorge, Natalia, linked owner |
| Overdue issue | Open issue past response deadline | Jorge, Natalia, linked owner |
| Approaching start | Scheduled, not started, starts today or tomorrow | Admin/CFO/project managers and office |
| Missed start | Scheduled date passed with no start evidence | Admin/CFO/project managers and office |
| Missing daily log | Started job, scheduled start reached, weekday after 18:00, no submitted field log or saved daily progress today | Admin/CFO/project managers and office |
| Excess days | Distinct recorded work dates exceed a matched estimate's planned days | Admin/CFO/project managers and office |
| Excess cost | Stored actual cost exceeds matched estimate's total cost before profit | Finance/office only |
| Proposal waiting | Unpaused/open request past explicit target, otherwise 3 days since last update/submission | Office/management, assigned estimator, salesperson |
| Overdue invoice | Sent or partially paid invoice past due date | Finance/office only |
| Overdue AR | Unpaid positive receivable explicitly marked Overdue | Finance/office only |

Receivable service-period dates are not treated as payment deadlines; those records currently have no dedicated due-date field. Invoice reminders use the actual invoice due date. Daily rules use America/Los_Angeles. Events are deduplicated per source, rule, recipient and local day. Resolved/closed issues and archived/completed jobs are excluded. Job/estimate matching uses stored IDs or estimate codes; no budget is guessed when no match exists. Log matching requires a job number. Alert scans paginate and fail explicitly at 50,000 rows per source.

Queue retry limits: at most five attempts, five-minute claim lease, exponential delay, automatic retry cutoff before the provider's 24-hour deduplication window. Operators must inspect provider delivery history before manually retrying uncertain old deliveries. The one-minute schedule delivers newly scanned alerts on the next run; issue-save notifications are already queued transactionally.

### Mobile and uploads

- Added 44 px phone button targets, 16 px form text, larger text areas, single-column estimator/issue forms and a compact sticky issue header.
- Added an offline status banner and duplicate-submit protection for daily logs.
- Live inspection found all field-log tables and the photo bucket absent. Added a private photo bucket and one owner-restricted `field_daily_logs` table that stores complete log snapshots atomically. Replaced partial parent/child saves with an atomic RPC, retry-safe identical saves, stale-draft checks, and locked submissions with separate corrections. Existing logs saved on devices remain device data until explicitly saved; no fabricated backfill was performed.
- Photo access uses signed URLs (24 hours), refreshed when saved logs are loaded. Existing service-period financial dates were preserved.
- Removed the existing daily-photo upload fallback that treated a local data URL as a successful cloud upload.
- Successful uploads attach only after storage confirms. Failed photos/receipts remain in an in-memory retry list with errors and a remove-failed-file option. Successful files in a partially failed batch are retained. Saving/submission waits for uploads to finish or failures to be removed.
- Retry uses the same unique storage path. The page warns before closing with pending uploads. **Unuploaded File objects are not preserved after page closure; keep the page open or reselect those files.** Existing text draft storage remains in place.
- Fixed the existing Google Maps helper's unguarded `process.env` access, which crashed browser previews when no Maps key existed.

## Backend files and deployment sequence

Applied/deployed to the confirmed Supabase project:

1. `supabase/migrations/20260925120000_active_job_issue_workflow.sql`
   - Adds `job_issue_audit`, `workflow_notifications`, RLS/grants, atomic issue RPC and the issue-preservation trigger.
2. `supabase/migrations/20260925121000_workflow_delivery_queue.sql`
   - Adds server-only leased notification claims and bounded retry handling.
3. `supabase/migrations/20260925122000_field_daily_log_storage.sql`
   - Adds atomic field-log snapshots, ownership restrictions, locked submissions, and private photo storage.
4. `supabase/functions/process-workflow-notifications/index.ts` and shared rule evaluator.
5. `supabase/operations/enable-workflow-schedule.sql`
   - Optional explicit activation script for a one-minute Supabase Cron/pg_net schedule using Vault references. This is not automatically applied by migrations.

Deployment results:

- Only the three new migrations above were applied; all executed successfully on PostgreSQL 17.6.
- Existing Jorge/Natalia profiles and roles were confirmed. New grants explicitly revoke Supabase default table privileges before granting read/acknowledgment access; tests model those default grants.
- Vercel preview deployments were used to find and correct split-chunk startup behavior. The final app was deployed to the existing production project, not a replacement site. Its sign-in page renders, with no captured startup console errors.
- Supabase CLI deployment attempts stalled and were terminated. Migrations and function deployments were completed via the authenticated dashboard instead. Source artifacts used for the dashboard match the local reviewed files.
- Initial read-only alert preview returned HTTP 200, no scan failures, and 12 waiting proposals plus 11 receivables classified by the initial rule. Before any scheduled delivery, the receivable rule was corrected to honor explicit Overdue status and avoid interpreting service-period dates as deadlines.
- The `crt-workflow-notifications` schedule is active every minute (cron job 2). Final dry-run returned HTTP 200 with no scan failures: 12 waiting proposals, 11 explicitly Overdue receivables, 65 recipient notifications. The first scheduled run queued those records; subsequent runs began provider-accepted delivery, including both Jorge and Natalia. At 2026-09-25 21:01 UTC, all 65 notifications were marked sent after one attempt, with no failures or remaining pending messages; 23 each were addressed to Jorge and Natalia. This confirms provider acceptance, not mailbox placement/read receipt. Recent cron runs succeeded and the queue stayed deduplicated.
- No fake operational records or test emails were used. Notification deliveries, once enabled, concern existing business records under the requested workflow.

Rollback: disable `crt-workflow-notifications` in Supabase Cron first if notifications misbehave. Preserve queue/audit tables and historical records. Do not roll back to the old issue-saving frontend while leaving the protection trigger active: legacy whole-array issue writes are intentionally ignored. Coordinate a maintenance rollback or forward fix instead of deleting audit data.

## Verification and limitations

- Baseline: 289 existing Node tests passed; production build passed.
- Final: **307 tests passed** (including all baseline tests; affected source-contract tests now follow extracted workspace code).
- New executable PostgreSQL tests apply issue/queue migrations locally with PGlite and cover preservation of legacy issues, authorization/RLS, missing owner/deadline rejection, duplicate requests, changed retry payloads, critical deadline cap, confirmed resolution, reopening, stale edit rejection, and exclusive delivery leases.
- Field-log database tests cover atomic snapshot preservation, repeat-save idempotency, stale edits, owner isolation, submitted-log locks, and corrections.
- Alert tests cover local timezone dates, start/missing-log rules, resolved suppression, stable event keys, actual-vs-budget/day comparisons, paid/paused/closed exclusion, and finance-recipient restrictions.
- Service math tests cover loaded labor, travel, material totals, overhead and markup; real jsPDF tests export all three estimate types and verify material/scope/price content and multiple-page output.
- `npm run build` passes. New/extracted workspace components and service calculation module pass targeted ESLint. `git diff --check` passes.
- Live anonymous REST access tests returned HTTP 401 / permission denied for `job_issue_audit`, `workflow_notifications`, and `field_daily_logs`.
- `deno check supabase/functions/process-workflow-notifications/index.ts` passes.
- Browser fixture checks: service screens at 320/390/768/1280 px had no horizontal overflow; phone buttons were at least 44 px. Checked template selection, overhead recalculation and callback wiring. Actual issue dialog at 320 px fit the viewport and exposed the required resolution note/checkbox. These were isolated test fixtures, not authenticated production end-to-end tests.
- Repository-wide lint is **not clean**. Baseline App had 111 errors/5 warnings, including 12 undefined references; those pre-existing undefined references remain. Extraction also changes React compiler lint analysis of passed callbacks. This task does not claim a clean full lint run.
- Locked dependency installation reported **11 vulnerabilities (1 low, 3 moderate, 6 high, 1 critical)**. No broad or breaking dependency upgrades were made. This needs separate reviewed remediation.
- Signed-in app save/upload/proposal acceptance remains unverified until a company user signs in. Database logic has been exercised locally and migration compatibility verified against production without creating dummy records.
- Supabase already reported RLS disabled on `completed_job_metrics`, `approved_jobs`, and `completed_jobs` before these changes. That pre-existing access-control issue was not silently changed as part of this rollout.
- Live desktop sign-in renders with 44 px buttons and no captured startup errors. The in-app viewport override did not change the live viewport; cross-origin phone-frame checks did not load. Phone layout evidence is limited to the local fixture checks above.
- Full mobile acceptance on Ivan's, Chris's and Miguel's actual devices remains: camera/file permissions, HEIC/large images, weak-network interruption/recovery, signed-in navigation through each extracted screen, draft reload, and end-to-end save/proposal/PDF/download behavior. Large images over 20 MB are rejected with a visible message.

## Reproduce local checks

```sh
npm ci
npm test
npm run build
npm run preview:mobile
# Open http://127.0.0.1:5173/tests/mobile-preview.html
```

The mobile fixture generator copies real rendering/calculation code into ignored local helper modules and disables its database client. The fixture data is synthetic and never written to company storage.

References: [Supabase Cron](https://supabase.com/docs/guides/cron), [Resend idempotency keys](https://resend.com/changelog/idempotency-keys).


## Signed-in follow-up verification — September 25, 2026

- Signed in as the existing CFO account. Confirmed all three service estimate workspaces, CFO dashboard, CRM, Approved Jobs list and detail, Active Jobs list and detail, Field Operations, and Administration render with the existing company data.
- Opened the issue form and confirmed the employee owner list, severity choices, deadline, audit section, and resolution workflow entry points. No issue was saved or fabricated.
- Blank coating estimate save was rejected with “Enter a job name and customer.” No estimate, proposal, job, employee, or field-log records were created or changed by this acceptance pass.
- Workflow inbox displayed 24 actual alerts with sent email status. Did not acknowledge alerts on the user's behalf.
- Found and corrected obsolete placeholder wording on the active-job page, field review, and estimate dashboard shortcut.
- Browser logs exposed a pre-existing missing `toPlainObject` helper that interrupted shared pricing/travel-settings hydration. Added the missing import and a tested parser that preserves object/serialized-object settings and falls back for invalid values.
- Missing `company_vehicles` table still causes a warning; the field form displays its existing fallback vehicles. Google Maps has no configured API key; manual travel input remains available.
- Source inspection identified an additional limitation: field-log reads and photo access are owner-restricted, so Office Review currently cannot retrieve other employees' submissions. Company-wide office review still needs a narrowly scoped role-based read policy, matching query changes, and cross-account validation. Existing ownership protections were not widened during this pass.
- End-to-end production issue saves/resolution, estimate saves/proposals/PDF downloads, uploads, and actual-phone/weak-network acceptance remain unverified. This pass used read-only navigation and rejected invalid input to preserve real records; local transaction and PDF tests remain the write-path evidence.


## Office Review access update — September 25, 2026

The user requested proceeding with cross-employee Office Review. The prepared migration `20260925130000_field_log_office_review.sql` allows existing Admin/CFO accounts (including Natalia/Jorge) to read submitted crew logs and their referenced photos/receipts. Other employees retain access only to their own logs. Drafts, unreferenced photos, unrelated buckets, and all write permissions remain unchanged. No historical records are modified.

The matching frontend uses the RLS-visible record set instead of forcing an owner-only query, paginates results, refreshes on review entry/manual refresh, displays loading failures, and excludes shared crew records from offline local storage. Regression tests cover both office roles, employee isolation, private drafts, photo/receipt references, unrelated files, role revocation, denied writes, pagination, and failed loads. All 313 tests and the production build passed during preparation.

The user explicitly approved Admin/CFO read access to all submitted crew logs and attached photos/receipts. Migration `20260925130000` was validated in production with ROLLBACK, then applied and recorded in one committed transaction through the Supabase dashboard. Both operations succeeded. Before activation, the field-log table contained zero rows; no synthetic records were inserted. The frontend is being released with this migration. No Edge Function change is required. The 313 passing tests include cross-account access and photo isolation; actual submitted crew records still need live acceptance when available.


## Final hardening and acceptance follow-up — September 25, 2026

- Fixed company-vehicle normalization so locally cached camelCase records retain vehicle names, unit numbers, plates, and type on reload. Older blank entries are repaired only by matching an existing configured vehicle ID; no vehicle records are invented. A specifically absent optional `company_vehicles` table uses the established configured/cache list; other errors remain visible in diagnostics.
- Updated jsPDF from 2.5.x to 4.2.1 and PDF.js from 5.7.x to 6.3.289; applied compatible dependency patches. npm audit then reported zero known vulnerabilities. Reviewed upstream [jsPDF release notes](https://github.com/parallax/jsPDF/releases) and [PDF.js releases](https://github.com/mozilla/pdf.js/releases). This is the audit result at verification time, not a guarantee against all vulnerabilities.
- PDF import disables evaluation and releases its PDF loading task after extraction. Browser compatibility checks exercised real generation, text extraction, and first-page rendering for all three service estimates and their proposals, plus a proposal request (seven PDFs). These used isolated synthetic fixtures with no database connection. Invoice PDF generation also has an executable regression test.
- The new database inspection confirmed `approved_jobs`, `completed_jobs`, and `completed_job_metrics` had no policies, RLS disabled, and anonymous read/write grants. Migration `20260925140000_protect_legacy_job_tables.sql` was tested locally, validated live with ROLLBACK, then applied/recorded in a committed transaction. It enables RLS, requires a provisioned company profile, removes anonymous/public table access and direct truncate/trigger privileges, and retains existing company-member CRUD access. This closes anonymous/non-company access; it does not introduce finer per-employee permissions for these legacy shared tables. No historical rows were changed. Anonymous REST checks for all three returned HTTP 401.
- Tests cover vehicle cache round trips, known-ID fallback, exact missing-table detection, provisioned-member operations, denied anonymous/non-member access, profile revocation, and prohibited truncate. All 318 automated tests and the production build pass. Repository-wide lint limitations documented earlier remain outside this follow-up.
- A genuine issue was supplied for live acceptance. Matching it to the correct job and confirming the response owner/deadline are pending; no issue was fabricated or marked resolved. Business incident details are kept out of this source-code report.
- Actual-device/weak-network testing and email mailbox receipt confirmation remain human acceptance items. Provider sent status is not proof of inbox placement.

## Mobile requests, task attachments, and sales follow-up — September 25, 2026

- Added **Submit Inspection Request** beside **Submit Proposal Request** in Tasks & Messages, plus an entry from Inspections. A compact phone form reuses CRM validation, existing lead storage, Ivan assignment, and task/email notification machinery. Its draft is scoped to the signed-in user on the device; submission errors preserve it. Task/proposal navigation now remounts the correct workspace. The existing CRM inspection handler releases busy state after unexpected network errors and does not attach an unrelated CRM draft's work-order file.
- Migration `20260925150000_mobile_task_requests_and_attachments.sql` adds an inspection-to-task mapping and `create_inspection_request_task` RPC with a transaction lock. Retrying the same lead/requester returns its task instead of issuing another assignment/email. It also adds `company_task_attachments`, the private `task-attachments` bucket (25 MB/file), participant-only policies, and server-validated, idempotent upload registration. It was validated with a live ROLLBACK and then committed and recorded in migration history. No existing business records were rewritten; no production test tasks/files/inspection requests were created.
- Tasks now expose **Add Photos & Files** after selecting or creating a task. Supported formats match proposal attachments, including phone HEIC/HEIF images, common images, PDF, Word, Excel, CSV and text. Partial failures retain selected files while the task remains open, and **Retry pending files** reuses their object IDs. Downloads use short-lived signed URLs. Unrelated employees, anonymous users, and revoked task assignees cannot read new files. No existing task visibility was expanded.
- Added **sales_follow_up** to the existing scheduled `process-workflow-notifications` Edge Function, deployed through Supabase. Reminders start exactly 72 hours after `proposal_requests.sent_at`, repeat at most once per Los Angeles calendar day, and route only to the assigned salesperson (including Ivan). Sent proposals no longer generate the older generic proposal-waiting alert. Signed, declined, closed, unsent, and undated records do not produce sales reminders. The proposal detail screen explains the reminder start. Existing scheduler and mail-delivery retry/idempotency remain in use. The live read-only count found zero eligible sent proposals at activation.
- Verification: **323 automated tests passed**, including local Postgres policy tests for private uploads, anonymous/outsider denial, revoked-assignee denial, registered-file integrity, inspection retry idempotency, the exact 72-hour reminder boundary, daily deduplication, recipient isolation, and upload retry behavior. Production build and targeted lint for the new form/upload components and WorkHub passed. Browser checks on an isolated fixture at 390px and 320px showed no horizontal page overflow; inspection draft recovery after reload, submission-to-task navigation, file chooser, simulated upload failure, and successful retry were exercised. No live database or mail provider is connected to this fixture.
- Manual verification still needed: one real inspection submission and attachment from the user's phone, native camera/photo-library behavior, and Ivan's eventual email receipt. Files pending upload must be reselected after leaving the task or closing the app; text inspection drafts persist locally. Unsupported or oversized attachments are rejected. A failed upload followed by leaving the task may leave a private, unregistered object requiring eventual administrative cleanup. Ballington remains pending per the user's instruction.
