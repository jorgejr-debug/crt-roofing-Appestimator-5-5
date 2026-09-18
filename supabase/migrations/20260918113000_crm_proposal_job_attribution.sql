BEGIN;

ALTER TABLE public.proposal_requests
  ADD COLUMN IF NOT EXISTS source_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_originator_id uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS lead_originator_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lead_originator_email text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS proposal_requests_source_lead_idx ON public.proposal_requests(source_lead_id);
CREATE INDEX IF NOT EXISTS proposal_requests_originator_idx ON public.proposal_requests(lead_originator_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.preserve_crm_lead_originator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.created_by := OLD.created_by;
  NEW.originator_id := OLD.originator_id;
  NEW.originator_name := OLD.originator_name;
  NEW.originator_email := OLD.originator_email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_leads_preserve_originator ON public.crm_leads;
CREATE TRIGGER crm_leads_preserve_originator
BEFORE UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.preserve_crm_lead_originator();

CREATE OR REPLACE FUNCTION public.assign_proposal_lead_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  lead public.crm_leads%ROWTYPE;
  candidate_id uuid;
BEGIN
  candidate_id := NEW.source_lead_id;
  IF candidate_id IS NULL
     AND coalesce(NEW.existing_lead_job_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    candidate_id := NEW.existing_lead_job_id::uuid;
  END IF;

  IF candidate_id IS NOT NULL THEN
    SELECT * INTO lead FROM public.crm_leads WHERE id = candidate_id;
    IF FOUND THEN
      NEW.source_lead_id := lead.id;
      NEW.lead_originator_id := lead.originator_id;
      NEW.lead_originator_name := lead.originator_name;
      NEW.lead_originator_email := lead.originator_email;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proposal_requests_assign_lead_attribution ON public.proposal_requests;
CREATE TRIGGER proposal_requests_assign_lead_attribution
BEFORE INSERT OR UPDATE OF existing_lead_job_id, source_lead_id ON public.proposal_requests
FOR EACH ROW EXECUTE FUNCTION public.assign_proposal_lead_attribution();

CREATE OR REPLACE FUNCTION public.sync_crm_lead_from_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_status text;
  now_at timestamptz := clock_timestamp();
BEGIN
  IF NEW.source_lead_id IS NULL THEN RETURN NEW; END IF;
  next_status := CASE NEW.status
    WHEN 'draft' THEN 'Contacted'
    WHEN 'submitted' THEN 'Estimate in Progress'
    WHEN 'under_review' THEN 'Estimate in Progress'
    WHEN 'missing_information' THEN 'Follow-Up'
    WHEN 'drafting_proposal' THEN 'Estimate in Progress'
    WHEN 'sales_review' THEN 'Proposal Sent'
    WHEN 'ready_to_send' THEN 'Proposal Sent'
    WHEN 'sent' THEN 'Proposal Sent'
    WHEN 'signed' THEN 'Approved'
    WHEN 'declined' THEN 'Lost'
    ELSE NULL
  END;
  UPDATE public.crm_leads
  SET status = coalesce(next_status, status),
      qualification_status = CASE WHEN NEW.status <> 'draft' THEN 'qualified' ELSE qualification_status END,
      qualified_at = CASE WHEN NEW.status <> 'draft' THEN coalesce(qualified_at, now_at) ELSE qualified_at END,
      qualified_by = CASE WHEN NEW.status <> 'draft' THEN coalesce(qualified_by, NEW.salesperson_id) ELSE qualified_by END,
      updated_at = now_at,
      updated_by = auth.uid(),
      lead_payload = coalesce(lead_payload, '{}'::jsonb) || jsonb_build_object(
        'proposalRequestId', NEW.id,
        'leadStatus', coalesce(next_status, status),
        'qualificationStatus', CASE WHEN NEW.status <> 'draft' THEN 'qualified' ELSE qualification_status END,
        'qualifiedAt', CASE WHEN NEW.status <> 'draft' THEN coalesce(qualified_at, now_at) ELSE qualified_at END,
        'updatedAt', now_at
      )
  WHERE id = NEW.source_lead_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proposal_requests_sync_crm_lead ON public.proposal_requests;
CREATE TRIGGER proposal_requests_sync_crm_lead
AFTER INSERT OR UPDATE OF status, source_lead_id ON public.proposal_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_crm_lead_from_proposal();

CREATE OR REPLACE FUNCTION public.carry_lead_attribution_to_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  request public.proposal_requests%ROWTYPE;
  scope_owner_name text := '';
BEGIN
  IF NEW.proposal_request_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO request FROM public.proposal_requests WHERE id = NEW.proposal_request_id;
  IF NOT FOUND OR request.source_lead_id IS NULL THEN RETURN NEW; END IF;
  SELECT coalesce(full_name, email, '') INTO scope_owner_name FROM public.user_profiles WHERE id = request.salesperson_id;
  NEW.job_payload := coalesce(NEW.job_payload, '{}'::jsonb) || jsonb_build_object(
    'sourceLeadId', request.source_lead_id,
    'leadOriginatorId', request.lead_originator_id,
    'leadOriginatorName', request.lead_originator_name,
    'leadOriginatorEmail', request.lead_originator_email,
    'relationshipOwnerId', request.lead_originator_id,
    'scopeSalespersonId', request.salesperson_id,
    'scopeSalespersonName', scope_owner_name,
    'salesperson', request.lead_originator_name,
    'commissionRecipientId', request.lead_originator_id,
    'commissionRecipientName', request.lead_originator_name,
    'commissionRecipientEmail', request.lead_originator_email,
    'salesCommissionRate', CASE WHEN lower(request.lead_originator_email) = 'chris@crtroofing.com' THEN 0.25 ELSE 0 END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS active_jobs_carry_lead_attribution ON public.active_jobs;
CREATE TRIGGER active_jobs_carry_lead_attribution
BEFORE INSERT OR UPDATE OF proposal_request_id, job_payload ON public.active_jobs
FOR EACH ROW EXECUTE FUNCTION public.carry_lead_attribution_to_job();

UPDATE public.proposal_requests
SET source_lead_id = existing_lead_job_id::uuid
WHERE source_lead_id IS NULL
  AND coalesce(existing_lead_job_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM public.crm_leads WHERE id = existing_lead_job_id::uuid);

UPDATE public.active_jobs
SET job_payload = job_payload
WHERE proposal_request_id IS NOT NULL;

COMMENT ON COLUMN public.proposal_requests.source_lead_id IS 'CRM lead that originated the Proposal Request and downstream production job.';
COMMENT ON COLUMN public.proposal_requests.lead_originator_id IS 'Immutable business-development attribution copied from the source CRM lead.';

COMMIT;
