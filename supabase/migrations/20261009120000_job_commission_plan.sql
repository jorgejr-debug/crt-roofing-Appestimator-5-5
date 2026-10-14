BEGIN;

CREATE OR REPLACE FUNCTION public.carry_lead_attribution_to_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    'commissionRecipientEmail', request.lead_originator_email
  );
  -- Only initialize new jobs. Existing jobs retain their saved rates and plans.
  IF TG_OP = 'INSERT' AND coalesce(jsonb_typeof(NEW.job_payload->'commissionPlan'), 'null') <> 'object' THEN
    NEW.job_payload := NEW.job_payload || jsonb_build_object('commissionPlan', jsonb_build_object(
      'ivan', jsonb_build_object('enabled', coalesce(lower(scope_owner_name) LIKE '%ivan%', false) OR coalesce(lower(request.lead_originator_email) = 'ivan@crtroofing.com', false), 'rate', 0.05),
      'chris', jsonb_build_object('enabled', coalesce(lower(request.lead_originator_email) = 'chris@crtroofing.com', false) OR coalesce(lower(scope_owner_name) LIKE '%chris%', false), 'rate', 0.15)
    ));
  END IF;
  RETURN NEW;
END;
$function$
;

COMMIT;
