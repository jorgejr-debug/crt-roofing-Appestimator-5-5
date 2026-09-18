BEGIN;

CREATE OR REPLACE FUNCTION public.is_project_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles AS profile
    WHERE profile.id = auth.uid()
      AND lower(coalesce(profile.role, '')) = 'project_manager'
  );
$$;

REVOKE ALL ON FUNCTION public.is_project_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_manager() TO authenticated;

UPDATE public.user_profiles
SET full_name = 'Miguel Figueroa',
    role = 'project_manager',
    updated_at = now()
WHERE lower(coalesce(email, '')) = 'miguel@crtroofing.com';

CREATE OR REPLACE FUNCTION public.is_daily_job_cost_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'daniela@crtroofing.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid()
        AND lower(coalesce(role, '')) IN ('admin', 'cfo', 'project_manager')
    );
$$;

REVOKE ALL ON FUNCTION public.is_daily_job_cost_editor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_daily_job_cost_editor() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_project_manager_active_job(
  p_source_record_uid text,
  p_updates jsonb
)
RETURNS SETOF public.active_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_role text;
  job public.active_jobs%ROWTYPE;
  saved_job public.active_jobs%ROWTYPE;
  unsupported_key text;
  normalized_status text;
  now_at timestamptz := clock_timestamp();
  allowed_keys constant text[] := ARRAY[
    'propertyManager', 'projectContact', 'projectManager',
    'fieldSupervisor', 'foreman', 'officeCoordinator', 'status',
    'currentPhase', 'riskLevel', 'riskReason', 'startDate',
    'expectedCompletionDate', 'percentComplete', 'issues', 'activityLog'
  ];
BEGIN
  SELECT lower(coalesce(profile.role, ''))
  INTO actor_role
  FROM public.user_profiles AS profile
  WHERE profile.id = auth.uid();

  IF actor_role NOT IN ('admin', 'cfo', 'project_manager') THEN
    RAISE EXCEPTION 'Project Manager access required' USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(coalesce(p_source_record_uid, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Active job is required' USING ERRCODE = '22023';
  END IF;

  SELECT key
  INTO unsupported_key
  FROM jsonb_object_keys(coalesce(p_updates, '{}'::jsonb)) AS key
  WHERE NOT (key = ANY (allowed_keys))
  LIMIT 1;

  IF unsupported_key IS NOT NULL THEN
    RAISE EXCEPTION 'Project Managers cannot update %', unsupported_key USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO job
  FROM public.active_jobs
  WHERE source_record_uid = trim(p_source_record_uid)
  FOR UPDATE;

  IF job.id IS NULL OR lower(coalesce(job.workflow_status, '')) <> 'active' THEN
    RAISE EXCEPTION 'Only an active production job can be updated' USING ERRCODE = 'P0002';
  END IF;

  normalized_status := coalesce(nullif(trim(p_updates ->> 'status'), ''), job.status, 'In Progress');
  IF lower(normalized_status) IN ('approved', 'completed', 'closed', 'archived', 'deleted') THEN
    RAISE EXCEPTION 'Project Managers cannot release, complete, close, or archive jobs from this screen' USING ERRCODE = '42501';
  END IF;

  UPDATE public.active_jobs AS active_job
  SET
    project_contact = CASE WHEN p_updates ? 'projectContact' THEN coalesce(p_updates ->> 'projectContact', '') ELSE active_job.project_contact END,
    field_supervisor = CASE WHEN p_updates ? 'fieldSupervisor' THEN coalesce(p_updates ->> 'fieldSupervisor', '') ELSE active_job.field_supervisor END,
    status = normalized_status,
    start_date = CASE
      WHEN p_updates ? 'startDate' AND nullif(p_updates ->> 'startDate', '') IS NOT NULL THEN (p_updates ->> 'startDate')::date
      WHEN p_updates ? 'startDate' THEN NULL
      ELSE active_job.start_date
    END,
    risk_level = CASE WHEN p_updates ? 'riskLevel' THEN coalesce(nullif(p_updates ->> 'riskLevel', ''), 'Normal') ELSE active_job.risk_level END,
    updated_by = auth.uid()::text,
    updated_at = now_at,
    saved_at = now_at,
    job_payload = coalesce(active_job.job_payload, '{}'::jsonb)
      || coalesce(p_updates, '{}'::jsonb)
      || jsonb_build_object(
        'workflowStatus', 'active',
        'status', normalized_status,
        'projectStatus', normalized_status,
        'updatedAt', now_at,
        'updatedBy', auth.uid()::text
      )
  WHERE active_job.id = job.id
  RETURNING active_job.* INTO saved_job;

  RETURN NEXT saved_job;
END;
$$;

REVOKE ALL ON FUNCTION public.save_project_manager_active_job(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_project_manager_active_job(text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.save_project_manager_active_job(text, jsonb) IS
  'Allows production managers to update operational fields on active jobs without changing proposal authorization, pricing, commission, billing, or finance data.';

COMMIT;
