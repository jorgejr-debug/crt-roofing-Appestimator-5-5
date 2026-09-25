-- Run only against the confirmed production project AFTER deploying the function.
-- In Supabase Vault, configure workflow_function_url (full HTTPS function URL)
-- workflow_webhook_secret (same value as TASK_NOTIFICATION_WEBHOOK_SECRET),
-- and workflow_gateway_authorization (Bearer + the existing public legacy anon key).
-- Secrets are referenced at runtime, never embedded in cron.job.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='workflow_function_url' AND decrypted_secret LIKE 'https://%/functions/v1/process-workflow-notifications')
     OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='workflow_webhook_secret' AND length(decrypted_secret)>0)
     OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='workflow_gateway_authorization' AND decrypted_secret LIKE 'Bearer %') THEN
    RAISE EXCEPTION 'Configure the workflow function URL and webhook secret in Vault first';
  END IF;
END $$;
SELECT cron.schedule('crt-workflow-notifications','* * * * *',$job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='workflow_function_url'),
    headers := jsonb_build_object('Content-Type','application/json','Authorization',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='workflow_gateway_authorization'),'x-task-webhook-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='workflow_webhook_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
