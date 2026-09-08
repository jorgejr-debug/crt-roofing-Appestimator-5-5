BEGIN;

-- Daily cost entry is available before a job moves to Active, so the narrowly
-- scoped staff function must accept both approved and active workflow rows.
CREATE OR REPLACE FUNCTION public.save_staff_daily_job_progress_day(
  p_source_record_uid text,
  p_day jsonb,
  p_updated_by text DEFAULT ''
)
RETURNS SETOF public.active_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  day_id text := nullif(trim(coalesce(p_day ->> 'id', '')), '');
  existing_log jsonb;
  next_log jsonb;
  saved_job public.active_jobs%ROWTYPE;
BEGIN
  IF NOT public.is_daily_job_cost_editor() THEN
    RAISE EXCEPTION 'Not authorized to update daily job costs' USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(coalesce(p_source_record_uid, '')), '') IS NULL OR day_id IS NULL THEN
    RAISE EXCEPTION 'Missing approved job or daily progress identifier' USING ERRCODE = '22023';
  END IF;

  SELECT CASE
    WHEN jsonb_typeof(jobs.daily_progress_log) = 'array' THEN jobs.daily_progress_log
    ELSE '[]'::jsonb
  END
  INTO existing_log
  FROM public.active_jobs AS jobs
  WHERE jobs.source_record_uid = p_source_record_uid
    AND lower(coalesce(jobs.workflow_status, '')) IN ('approved', 'active')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved or active job not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(jsonb_agg(entry), '[]'::jsonb)
  INTO next_log
  FROM jsonb_array_elements(existing_log) AS entry
  WHERE entry ->> 'id' <> day_id;

  next_log := next_log || jsonb_build_array(p_day);

  UPDATE public.active_jobs AS jobs
  SET
    daily_progress_log = next_log,
    updated_at = clock_timestamp(),
    updated_by = nullif(trim(coalesce(p_updated_by, '')), ''),
    job_payload = coalesce(jobs.job_payload, '{}'::jsonb) || jsonb_build_object(
      'dailyProgressLog', next_log,
      'updatedAt', clock_timestamp()
    )
  WHERE jobs.source_record_uid = p_source_record_uid
  RETURNING jobs.* INTO saved_job;

  RETURN NEXT saved_job;
END;
$$;

REVOKE ALL ON FUNCTION public.save_staff_daily_job_progress_day(text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_staff_daily_job_progress_day(text, jsonb, text) TO authenticated;

COMMIT;
