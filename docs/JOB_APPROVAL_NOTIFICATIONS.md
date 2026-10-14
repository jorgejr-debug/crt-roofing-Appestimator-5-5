# Miguel job approval notifications

Deployed October 7, 2026 to production Supabase project `vomgasmchiynffcyfirn` through the Management API, using only `20261007120000_job_approval_notifications.sql`. The local CLI project link points elsewhere and was not used or changed. Migration history was not modified; the SQL is safe to reapply.

New `active_jobs` rows with `workflow_status = approved`, or rows transitioning into that state, queue a `job_approved` notification for `miguel@crtroofing.com`. The existing dashboard inbox displays it and the existing scheduled `process-workflow-notifications` worker emails it. No frontend or worker redeployment was required.

A unique event key based on the job UUID prevents repeat alerts for subsequent saves and reapproval of the same job. Existing rows are not backfilled. Notifications and approvals commit together. Installation requires exactly one matching profile; removing or duplicating that profile subsequently causes approval saves to fail instead of silently losing alerts.

Verification: production recipient is Miguel's project_manager account; trigger installed and enabled; existing workflow email cron active. Existing queue had 1,097 sent messages at preflight. No test business records or test emails were created in production; delivery of the first new approval is not yet confirmed. Six focused SQL tests passed, covering approval, repeat saves, rollback, recipient isolation, missing recipient and existing issue/delivery behavior.
