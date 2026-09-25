BEGIN;
CREATE FUNCTION public.claim_workflow_notifications()
RETURNS SETOF public.workflow_notifications LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.workflow_notifications SET email_status='failed', email_error=CASE WHEN email_error='' THEN 'Automatic retries stopped; review delivery before retrying manually.' ELSE email_error END
  WHERE email_status IN ('pending','sending','failed') AND next_attempt_at<=now() AND (attempts>=5 OR (attempts>0 AND created_at<=now()-interval '23 hours'));
  RETURN QUERY UPDATE public.workflow_notifications SET email_status='sending',attempts=attempts+1,next_attempt_at=now()+interval '5 minutes'
  WHERE id IN (SELECT id FROM public.workflow_notifications WHERE email_status IN ('pending','sending','failed') AND next_attempt_at <= now() AND attempts<5 AND (attempts=0 OR created_at>now()-interval '23 hours') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20)
  RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_workflow_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_workflow_notifications() TO service_role;
GRANT ALL ON public.workflow_notifications TO service_role;
COMMIT;
