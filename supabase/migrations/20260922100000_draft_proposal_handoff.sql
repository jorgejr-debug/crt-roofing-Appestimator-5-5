-- Let Ivan hand Daniela a field-drafted proposal without misrepresenting it as a
-- complete Proposal Request. Daniela explicitly accepts the handoff before the SLA starts.

ALTER TABLE public.proposal_requests
  ADD COLUMN IF NOT EXISTS intake_mode text NOT NULL DEFAULT 'full_request',
  ADD COLUMN IF NOT EXISTS draft_handoff_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS draft_handoff_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS draft_handoff_accepted_at timestamptz;

ALTER TABLE public.proposal_requests DROP CONSTRAINT IF EXISTS proposal_requests_intake_mode_check;
ALTER TABLE public.proposal_requests ADD CONSTRAINT proposal_requests_intake_mode_check
  CHECK (intake_mode IN ('full_request','quick_inspection','draft_proposal'));

ALTER TABLE public.proposal_requests DROP CONSTRAINT IF EXISTS proposal_requests_draft_handoff_status_check;
ALTER TABLE public.proposal_requests ADD CONSTRAINT proposal_requests_draft_handoff_status_check
  CHECK (draft_handoff_status IN ('none','awaiting_review','accepted','missing_information'));

CREATE OR REPLACE FUNCTION public.submit_draft_proposal_handoff(p_request_id uuid,p_has_draft_proposal boolean DEFAULT false)
RETURNS public.proposal_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE request public.proposal_requests; estimator uuid; task public.company_tasks;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO request FROM public.proposal_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR (request.salesperson_id<>auth.uid() AND request.created_by<>auth.uid() AND NOT public.is_proposal_manager()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF request.status NOT IN ('draft','missing_information') THEN
    RAISE EXCEPTION 'Only a draft or returned handoff can be sent';
  END IF;
  IF trim(request.customer_name)='' OR trim(request.service_address)='' OR trim(request.measurements)='' OR trim(request.scope_of_work)='' THEN
    RAISE EXCEPTION 'Customer/job, service address, measurements, and observed scope are required';
  END IF;

  SELECT id INTO estimator FROM public.user_profiles WHERE lower(email)='daniela@crtroofing.com' LIMIT 1;
  estimator:=coalesce(request.assigned_estimator_id,estimator);
  IF estimator IS NULL THEN RAISE EXCEPTION 'Daniela or another estimator is not configured'; END IF;

  IF request.task_id IS NULL THEN
    INSERT INTO public.company_tasks(title,description,status,priority,due_date,related_type,related_id,related_label,created_by,task_type)
    VALUES(
      CASE WHEN p_has_draft_proposal THEN 'Draft Proposal Handoff: ' ELSE 'Inspection Handoff: ' END||request.customer_name,
      concat_ws(E'\n',
        'Proposal Request PR-'||request.request_number,
        'Customer / job: '||request.customer_name,
        'Address: '||request.service_address,
        'Work type: '||coalesce(nullif(request.work_type,''),'Not entered'),
        'Measurements: '||request.measurements,
        'Scope observed: '||request.scope_of_work,
        CASE WHEN p_has_draft_proposal THEN 'Ivan attached a field-drafted proposal for estimator review.' ELSE 'Early inspection handoff; no draft proposal was attached.' END,
        'Pre-queue review only. The estimating SLA has not started.'
      ),
      'open',CASE request.priority WHEN 'rush' THEN 'urgent' WHEN 'high' THEN 'high' ELSE 'normal' END,
      request.customer_deadline,'proposal_request',request.id::text,request.customer_name,request.created_by,'proposal_request'
    ) RETURNING * INTO task;
    INSERT INTO public.company_task_assignees(task_id,user_id,assigned_by)
      VALUES(task.id,estimator,auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
    SELECT * INTO task FROM public.company_tasks WHERE id=request.task_id;
    UPDATE public.company_tasks SET status='open' WHERE id=request.task_id;
    INSERT INTO public.company_task_assignees(task_id,user_id,assigned_by)
      VALUES(request.task_id,estimator,auth.uid()) ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.proposal_requests SET
    task_id=task.id,
    assigned_estimator_id=estimator,
    intake_mode=CASE WHEN p_has_draft_proposal THEN 'draft_proposal' ELSE 'quick_inspection' END,
    draft_handoff_status='awaiting_review',
    draft_handoff_submitted_at=now(),
    missing_information_notes='',
    status='draft',
    target_completion_at=NULL,
    accepted_at=NULL,
    updated_at=now()
  WHERE id=request.id RETURNING * INTO request;

  PERFORM public.queue_proposal_notification(request.id,estimator,'draft_handoff_submitted',
    CASE WHEN p_has_draft_proposal THEN 'Ivan submitted a draft proposal for review.' ELSE 'Ivan submitted a quick inspection handoff for review.' END);
  PERFORM public.write_proposal_audit(request.id,'draft_handoff_submitted',
    CASE WHEN p_has_draft_proposal THEN 'Field-drafted proposal attached; awaiting estimator acceptance.' ELSE 'Inspection handoff awaiting estimator acceptance.' END);
  RETURN request;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_draft_proposal_handoff(p_request_id uuid,p_action text,p_missing_notes text DEFAULT '',p_target_at timestamptz DEFAULT NULL)
RETURNS public.proposal_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE request public.proposal_requests; accepted_time timestamptz:=now(); target_time timestamptz;
BEGIN
  IF NOT (public.is_company_estimator() OR public.is_proposal_manager()) THEN RAISE EXCEPTION 'Estimator access required'; END IF;
  SELECT * INTO request FROM public.proposal_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR request.draft_handoff_status<>'awaiting_review' OR request.status<>'draft' THEN
    RAISE EXCEPTION 'Draft handoff is not awaiting review';
  END IF;

  IF p_action='accept' THEN
    target_time:=coalesce(p_target_at,request.manual_target_at,
      CASE request.job_type WHEN 'complex_commercial' THEN public.add_proposal_business_days(accepted_time,2)
        WHEN 'large_rfp' THEN NULL ELSE public.add_proposal_business_days(accepted_time,1) END);
    IF request.job_type='large_rfp' AND target_time IS NULL THEN RAISE EXCEPTION 'Set a manual ETA before accepting a large RFP'; END IF;
    UPDATE public.proposal_requests SET
      status='under_review',draft_handoff_status='accepted',draft_handoff_accepted_at=accepted_time,
      accepted_at=accepted_time,target_completion_at=target_time,updated_at=now()
    WHERE id=request.id RETURNING * INTO request;
    PERFORM public.queue_proposal_notification(request.id,request.salesperson_id,'draft_handoff_accepted','Daniela accepted the handoff and began estimating.');
    PERFORM public.write_proposal_audit(request.id,'draft_handoff_accepted','Estimator accepted the field draft; SLA started.');
  ELSIF p_action='missing_information' THEN
    IF trim(coalesce(p_missing_notes,''))='' THEN RAISE EXCEPTION 'Describe the missing information'; END IF;
    UPDATE public.proposal_requests SET
      status='missing_information',draft_handoff_status='missing_information',missing_information_notes=trim(p_missing_notes),
      missing_information_count=missing_information_count+1,target_completion_at=NULL,accepted_at=NULL,updated_at=now()
    WHERE id=request.id RETURNING * INTO request;
    PERFORM public.queue_proposal_notification(request.id,request.salesperson_id,'missing_information',trim(p_missing_notes));
    PERFORM public.write_proposal_audit(request.id,'information_requested',trim(p_missing_notes));
  ELSE
    RAISE EXCEPTION 'Invalid review action';
  END IF;
  RETURN request;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_draft_proposal_handoff(uuid,boolean),public.review_draft_proposal_handoff(uuid,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_draft_proposal_handoff(uuid,boolean),public.review_draft_proposal_handoff(uuid,text,text,timestamptz) TO authenticated;
