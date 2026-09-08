-- Let Ivan create new approved jobs without granting shared-job management or CFO access.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_staff_approved_job(
  p_project_name text,
  p_customer_name text DEFAULT '',
  p_project_address text DEFAULT '',
  p_contract_amount numeric DEFAULT 0,
  p_anticipated_start_date date DEFAULT NULL,
  p_project_contact text DEFAULT '',
  p_status text DEFAULT 'Approved'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  requester_role text;
  requester_email text;
  new_job_id uuid := gen_random_uuid();
  new_source_uid text;
  normalized_project_name text;
  normalized_status text;
  created_job public.active_jobs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lower(coalesce(role, '')), lower(coalesce(email, ''))
  INTO requester_role, requester_email
  FROM public.user_profiles
  WHERE id = auth.uid();

  requester_email := lower(coalesce(nullif(requester_email, ''), auth.jwt() ->> 'email', ''));

  IF requester_role NOT IN ('admin', 'cfo')
     AND requester_email <> 'ivan@crtroofing.com' THEN
    RAISE EXCEPTION 'You do not have permission to create approved jobs';
  END IF;

  normalized_project_name := nullif(trim(coalesce(p_project_name, '')), '');
  IF normalized_project_name IS NULL THEN
    RAISE EXCEPTION 'A job number or project name is required';
  END IF;

  normalized_status := coalesce(nullif(trim(p_status), ''), 'Approved');
  IF normalized_status IN ('Active', 'Completed', 'Closed') THEN
    RAISE EXCEPTION 'New jobs must begin in the approved or upcoming workflow';
  END IF;

  new_source_uid := 'job:staff-approved:' || new_job_id::text;

  INSERT INTO public.active_jobs (
    id,
    user_key,
    source_record_uid,
    workflow_status,
    estimate_id,
    local_estimate_id,
    job_number,
    job_name,
    project_name,
    customer_name,
    customer,
    address,
    job_address,
    status,
    contract_amount,
    final_bid,
    start_date,
    anticipated_start_date,
    project_contact,
    risk_level,
    is_active,
    saved_at,
    created_at,
    updated_at,
    updated_by,
    job_payload
  ) VALUES (
    new_job_id,
    requester_email,
    new_source_uid,
    'approved',
    new_job_id::text,
    new_job_id::text,
    normalized_project_name,
    normalized_project_name,
    normalized_project_name,
    nullif(trim(coalesce(p_customer_name, '')), ''),
    nullif(trim(coalesce(p_customer_name, '')), ''),
    nullif(trim(coalesce(p_project_address, '')), ''),
    nullif(trim(coalesce(p_project_address, '')), ''),
    normalized_status,
    greatest(coalesce(p_contract_amount, 0), 0),
    greatest(coalesce(p_contract_amount, 0), 0),
    p_anticipated_start_date,
    p_anticipated_start_date,
    nullif(trim(coalesce(p_project_contact, '')), ''),
    'Normal',
    true,
    now(),
    now(),
    now(),
    auth.uid()::text,
    jsonb_build_object(
      'id', new_job_id::text,
      'sourceRecordUid', new_source_uid,
      'projectName', normalized_project_name,
      'jobName', normalized_project_name,
      'jobNumber', normalized_project_name,
      'customerName', coalesce(p_customer_name, ''),
      'customer', coalesce(p_customer_name, ''),
      'projectAddress', coalesce(p_project_address, ''),
      'jobAddress', coalesce(p_project_address, ''),
      'contractAmount', greatest(coalesce(p_contract_amount, 0), 0),
      'finalBid', greatest(coalesce(p_contract_amount, 0), 0),
      'anticipatedStartDate', coalesce(to_char(p_anticipated_start_date, 'YYYY-MM-DD'), ''),
      'projectContact', coalesce(p_project_contact, ''),
      'status', normalized_status,
      'projectStatus', normalized_status,
      'workflowStatus', 'approved',
      'createdBy', auth.uid()::text
    )
  )
  RETURNING * INTO created_job;

  RETURN to_jsonb(created_job);
END;
$$;

ALTER FUNCTION public.create_staff_approved_job(text, text, text, numeric, date, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_staff_approved_job(text, text, text, numeric, date, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_staff_approved_job(text, text, text, numeric, date, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_staff_approved_job(text, text, text, numeric, date, text, text) TO authenticated;

COMMIT;
