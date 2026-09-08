-- Keep CFO Approved Jobs records synchronized with the shared jobs workflow.
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_cfo_approved_job_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  entry_id text;
  shared_source_uid text;
  shared_job_id text;
  shared_workflow_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.record_type = 'manual' AND OLD.card_key = 'approvedJobs' THEN
      shared_source_uid := 'job:cfo-approved:' || COALESCE(
        NULLIF(regexp_replace(OLD.source_record_uid, '^manual:approvedJobs:', ''), ''),
        OLD.id::text
      );
      UPDATE public.active_jobs
      SET workflow_status = 'archived',
          is_active = false,
          updated_at = now(),
          job_payload = jsonb_set(COALESCE(job_payload, '{}'::jsonb), '{workflowStatus}', '"archived"'::jsonb, true)
      WHERE source_record_uid = shared_source_uid;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.record_type = 'manual'
    AND OLD.card_key = 'approvedJobs'
    AND (
      NEW.record_type IS DISTINCT FROM OLD.record_type
      OR NEW.card_key IS DISTINCT FROM OLD.card_key
      OR NEW.source_record_uid IS DISTINCT FROM OLD.source_record_uid
    ) THEN
    shared_source_uid := 'job:cfo-approved:' || COALESCE(
      NULLIF(regexp_replace(OLD.source_record_uid, '^manual:approvedJobs:', ''), ''),
      OLD.id::text
    );
    UPDATE public.active_jobs
    SET workflow_status = 'archived',
        is_active = false,
        updated_at = now(),
        job_payload = jsonb_set(COALESCE(job_payload, '{}'::jsonb), '{workflowStatus}', '"archived"'::jsonb, true)
    WHERE source_record_uid = shared_source_uid;
  END IF;

  IF NEW.record_type <> 'manual' OR NEW.card_key <> 'approvedJobs' THEN
    RETURN NEW;
  END IF;

  entry_id := COALESCE(
    NULLIF(regexp_replace(NEW.source_record_uid, '^manual:approvedJobs:', ''), ''),
    NEW.id::text
  );
  shared_source_uid := 'job:cfo-approved:' || entry_id;
  shared_job_id := 'cfo-approved:' || entry_id;
  shared_workflow_status := CASE WHEN NEW.is_archived THEN 'archived' ELSE 'approved' END;

  INSERT INTO public.active_jobs (
    user_key,
    source_record_uid,
    workflow_status,
    estimate_id,
    local_estimate_id,
    job_name,
    project_name,
    status,
    contract_amount,
    final_bid,
    risk_level,
    is_active,
    saved_at,
    updated_at,
    updated_by,
    job_payload
  ) VALUES (
    COALESCE(NEW.updated_by::text, NEW.source_user_id::text, 'shared'),
    shared_source_uid,
    shared_workflow_status,
    shared_job_id,
    shared_job_id,
    COALESCE(NULLIF(trim(NEW.record_name), ''), 'Untitled approved job'),
    COALESCE(NULLIF(trim(NEW.record_name), ''), 'Untitled approved job'),
    COALESCE(NULLIF(trim(NEW.status), ''), 'Approved'),
    COALESCE(NEW.amount, 0),
    COALESCE(NEW.amount, 0),
    'Normal',
    NOT NEW.is_archived,
    COALESCE(NEW.created_at, NEW.updated_at, now()),
    COALESCE(NEW.updated_at, now()),
    NEW.updated_by::text,
    jsonb_build_object(
      'id', shared_job_id,
      'sourceRecordUid', shared_source_uid,
      'cfoApprovedJobEntryId', entry_id,
      'projectName', COALESCE(NULLIF(trim(NEW.record_name), ''), 'Untitled approved job'),
      'jobName', COALESCE(NULLIF(trim(NEW.record_name), ''), 'Untitled approved job'),
      'contractAmount', COALESCE(NEW.amount, 0),
      'finalBid', COALESCE(NEW.amount, 0),
      'approvalDate', COALESCE(to_char(NEW.record_date, 'YYYY-MM-DD'), ''),
      'projectStatus', COALESCE(NULLIF(trim(NEW.status), ''), 'Approved'),
      'status', COALESCE(NULLIF(trim(NEW.status), ''), 'Approved'),
      'note', COALESCE(NEW.note, ''),
      'workflowStatus', shared_workflow_status
    )
  )
  ON CONFLICT (source_record_uid) DO UPDATE SET
    user_key = EXCLUDED.user_key,
    workflow_status = EXCLUDED.workflow_status,
    estimate_id = EXCLUDED.estimate_id,
    local_estimate_id = EXCLUDED.local_estimate_id,
    job_name = EXCLUDED.job_name,
    project_name = EXCLUDED.project_name,
    status = EXCLUDED.status,
    contract_amount = EXCLUDED.contract_amount,
    final_bid = EXCLUDED.final_bid,
    risk_level = EXCLUDED.risk_level,
    is_active = EXCLUDED.is_active,
    saved_at = EXCLUDED.saved_at,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    job_payload = EXCLUDED.job_payload;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_cfo_approved_job_record() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_cfo_approved_job_record() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_sync_cfo_approved_job_record ON public.company_financial_records;
CREATE TRIGGER trg_sync_cfo_approved_job_record
AFTER INSERT OR UPDATE OR DELETE ON public.company_financial_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_cfo_approved_job_record();

-- Backfill all existing CFO Approved Jobs records into the shared workflow.
INSERT INTO public.active_jobs (
  user_key,
  source_record_uid,
  workflow_status,
  estimate_id,
  local_estimate_id,
  job_name,
  project_name,
  status,
  contract_amount,
  final_bid,
  risk_level,
  is_active,
  saved_at,
  updated_at,
  updated_by,
  job_payload
)
SELECT
  COALESCE(record.updated_by::text, record.source_user_id::text, 'shared'),
  'job:cfo-approved:' || record.entry_id,
  CASE WHEN record.is_archived THEN 'archived' ELSE 'approved' END,
  'cfo-approved:' || record.entry_id,
  'cfo-approved:' || record.entry_id,
  COALESCE(NULLIF(trim(record.record_name), ''), 'Untitled approved job'),
  COALESCE(NULLIF(trim(record.record_name), ''), 'Untitled approved job'),
  COALESCE(NULLIF(trim(record.status), ''), 'Approved'),
  COALESCE(record.amount, 0),
  COALESCE(record.amount, 0),
  'Normal',
  NOT record.is_archived,
  COALESCE(record.created_at, record.updated_at, now()),
  COALESCE(record.updated_at, now()),
  record.updated_by::text,
  jsonb_build_object(
    'id', 'cfo-approved:' || record.entry_id,
    'sourceRecordUid', 'job:cfo-approved:' || record.entry_id,
    'cfoApprovedJobEntryId', record.entry_id,
    'projectName', COALESCE(NULLIF(trim(record.record_name), ''), 'Untitled approved job'),
    'jobName', COALESCE(NULLIF(trim(record.record_name), ''), 'Untitled approved job'),
    'contractAmount', COALESCE(record.amount, 0),
    'finalBid', COALESCE(record.amount, 0),
    'approvalDate', COALESCE(to_char(record.record_date, 'YYYY-MM-DD'), ''),
    'projectStatus', COALESCE(NULLIF(trim(record.status), ''), 'Approved'),
    'status', COALESCE(NULLIF(trim(record.status), ''), 'Approved'),
    'note', COALESCE(record.note, ''),
    'workflowStatus', CASE WHEN record.is_archived THEN 'archived' ELSE 'approved' END
  )
FROM (
  SELECT
    financial.*,
    COALESCE(
      NULLIF(regexp_replace(financial.source_record_uid, '^manual:approvedJobs:', ''), ''),
      financial.id::text
    ) AS entry_id
  FROM public.company_financial_records AS financial
  WHERE financial.record_type = 'manual'
    AND financial.card_key = 'approvedJobs'
) AS record
ON CONFLICT (source_record_uid) DO UPDATE SET
  user_key = EXCLUDED.user_key,
  workflow_status = EXCLUDED.workflow_status,
  estimate_id = EXCLUDED.estimate_id,
  local_estimate_id = EXCLUDED.local_estimate_id,
  job_name = EXCLUDED.job_name,
  project_name = EXCLUDED.project_name,
  status = EXCLUDED.status,
  contract_amount = EXCLUDED.contract_amount,
  final_bid = EXCLUDED.final_bid,
  risk_level = EXCLUDED.risk_level,
  is_active = EXCLUDED.is_active,
  saved_at = EXCLUDED.saved_at,
  updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by,
  job_payload = EXCLUDED.job_payload;

COMMIT;
