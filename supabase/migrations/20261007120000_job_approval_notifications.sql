BEGIN;

-- Fail deployment explicitly if the intended recipient is missing or ambiguous.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.user_profiles WHERE lower(trim(email)) = 'miguel@crtroofing.com') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Miguel profile (miguel@crtroofing.com); approval notifications were not installed.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_miguel_job_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  recipient_id uuid;
  job_label text;
BEGIN
  IF lower(coalesce(NEW.workflow_status, '')) <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF lower(coalesce(OLD.workflow_status, '')) = 'approved' THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT id INTO STRICT recipient_id FROM public.user_profiles
  WHERE lower(trim(email)) = 'miguel@crtroofing.com';
  job_label := coalesce(nullif(trim(NEW.project_name), ''), nullif(trim(NEW.job_name), ''), 'Unnamed job');

  INSERT INTO public.workflow_notifications(event_key, user_id, source_record_uid, kind, message)
  VALUES (
    'job_approved:' || NEW.id::text,
    recipient_id,
    coalesce(nullif(NEW.source_record_uid, ''), 'job:' || NEW.id::text),
    'job_approved',
    'A job has been approved: ' || job_label || '. Open Approved Jobs in CRT Roofing to review it.'
  ) ON CONFLICT (event_key, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_miguel_job_approved() FROM PUBLIC, anon, authenticated;

-- No historical backfill. Future approval saves enqueue inbox and email together.
DROP TRIGGER IF EXISTS notify_miguel_job_approved ON public.active_jobs;
CREATE TRIGGER notify_miguel_job_approved
AFTER INSERT OR UPDATE OF workflow_status ON public.active_jobs
FOR EACH ROW EXECUTE FUNCTION public.notify_miguel_job_approved();

COMMIT;
