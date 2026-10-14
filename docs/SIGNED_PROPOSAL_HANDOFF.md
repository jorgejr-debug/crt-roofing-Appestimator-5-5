# Signed proposal handoff

Deployed October 7, 2026 to Supabase `vomgasmchiynffcyfirn` and https://crt-roofing-estimator.vercel.app (Vercel deployment `crt-roofing-estimator-ykdu0rxho-jorgejr-8255s-projects.vercel.app`).

## Office protocol

1. Download the customer-signed proposal from the email.
2. Open the corresponding estimate and choose Approve Job, then save. For a job without an estimate, use the Approved Jobs creation form.
3. When prompted, upload the signed PDF/JPG/PNG (maximum 15 MB) and confirm that the signature, scope and agreed price have been checked.
4. Finish saving the approval. The document stays private and linked to the job.
5. Miguel receives an inbox alert and email with a permanent app link. After signing into his account, he opens the document and selects Received signed proposal.
6. The office can open the job’s Signed proposal handoff section and refresh receipt status to see the recorded acknowledgment.

Existing jobs remain editable without retroactive document requirements. The office can attach a signed proposal to an existing job from its handoff section; approved/active jobs then generate a document-ready notification. This implementation retains an immutable first signed document per job; replacing contracts/amendment versioning is not included.

## Implementation and permissions

- `signed-proposals` is a private storage bucket. No authenticated update/delete policy allows overwriting a signed document.
- `signed_proposal_handoffs` records the source job, document path, uploader and upload time, Miguel’s identity and receipt time. Clients have SELECT only; restricted RPCs register and acknowledge documents.
- Upload/registration: admin/CFO, Daniela, or Ivan. Read: those users plus project managers. Receipt: Miguel only, after the corresponding job exists in approved/active/completed workflow.
- New canonical job writes require a registered proposal. Existing sources are grandfathered by a private migration snapshot. The trigger also checks insert/upsert paths and direct active/completed writes.
- The restricted staff creation RPC allows Daniela and Ivan to create a new approved job with a signed document, without granting general financial or job editing permissions.
- Notification emails use the existing workflow delivery worker. The email contains an authenticated app link, not an expiring storage URL. Opening the document requests a five-minute private storage URL.

## Deployment and validation

Applied only `20261007140000_signed_proposal_handoff.sql` and `20261007141000_staff_signed_proposal_approval.sql`, atomically through the Supabase Management API; local CLI database link was not used. Migration history was not modified. These migrations are not intended for replay.

Initial Vercel deploy omitted the team and returned Not authorized. Explicit `--scope jorgejr-8255s-projects` succeeded for both preview and production.

Automatic review rejected staging with the approval trigger disabled. That command did not run. The revised deployment kept the trigger enabled throughout; production verification confirms both approval and notification triggers enabled, storage private, handoff table RLS enabled and email cron active.

42 focused tests passed: upload/confirmation validation, server approval enforcement, recipient-only visibility, unauthorized RPC denial, persisted/idempotent Miguel acknowledgment, staff creation, legacy preservation, existing notifications/delivery and workspace permissions. Build passed; touched standalone modules passed ESLint. The monolithic App.jsx has pre-existing lint failures, so full lint is not a clean acceptance signal.

No real customer documents or production test jobs were created. First live customer handoff, email receipt, and acknowledgment still require end-to-end confirmation.
