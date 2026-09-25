BEGIN;

CREATE TABLE public.job_issue_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  source_record_uid text NOT NULL,
  issue_id text NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.user_profiles(id),
  action text NOT NULL,
  request_payload jsonb NOT NULL,
  before_issue jsonb,
  after_issue jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_issue_audit_job_idx ON public.job_issue_audit(source_record_uid, issue_id, created_at);
ALTER TABLE public.job_issue_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_issue_audit_read ON public.job_issue_audit FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND lower(role) IN ('admin','cfo','project_manager')));
REVOKE ALL ON public.job_issue_audit FROM anon,authenticated;
GRANT SELECT ON public.job_issue_audit TO authenticated;
GRANT ALL ON public.job_issue_audit TO service_role;

CREATE TABLE public.workflow_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id),
  source_record_uid text NOT NULL,
  kind text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sending','sent','failed')),
  email_sent_at timestamptz,
  email_error text NOT NULL DEFAULT '',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_key, user_id)
);
CREATE INDEX workflow_notifications_delivery_idx ON public.workflow_notifications(email_status, next_attempt_at);
ALTER TABLE public.workflow_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_notifications_read ON public.workflow_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY workflow_notifications_ack ON public.workflow_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.workflow_notifications FROM anon,authenticated;
GRANT SELECT ON public.workflow_notifications TO authenticated;
GRANT ALL ON public.workflow_notifications TO service_role;
GRANT UPDATE(read_at) ON public.workflow_notifications TO authenticated;

CREATE FUNCTION public.save_active_job_issue(p_source_record_uid text, p_issue jsonb, p_request_id uuid, p_expected_updated_at text DEFAULT NULL)
RETURNS SETOF public.active_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor public.user_profiles%ROWTYPE;
  job public.active_jobs%ROWTYPE;
  old_issue jsonb;
  saved_issue jsonb;
  issues jsonb;
  issue_id text := nullif(p_issue->>'id','');
  owner public.employees%ROWTYPE;
  now_at timestamptz := clock_timestamp();
  deadline timestamptz;
  issue_status text := coalesce(nullif(p_issue->>'status',''),'New');
  severity text := coalesce(nullif(p_issue->>'priority',''),'Normal');
  event_action text;
BEGIN
  SELECT * INTO actor FROM public.user_profiles WHERE id = auth.uid();
  IF actor.id IS NULL OR lower(coalesce(actor.role,'')) NOT IN ('admin','cfo','project_manager') THEN
    RAISE EXCEPTION 'Active job access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO job FROM public.active_jobs WHERE source_record_uid = p_source_record_uid FOR UPDATE;
  IF job.id IS NULL OR job.workflow_status <> 'active' THEN RAISE EXCEPTION 'Select an active production job'; END IF;
  IF EXISTS (SELECT 1 FROM public.job_issue_audit WHERE request_id = p_request_id AND source_record_uid = p_source_record_uid AND actor_id = actor.id) THEN
    IF EXISTS (SELECT 1 FROM public.job_issue_audit WHERE request_id=p_request_id AND request_payload IS DISTINCT FROM p_issue) THEN
      RAISE EXCEPTION 'The previous save was confirmed. Reload the issue before making further changes.';
    END IF;
    RETURN NEXT job; RETURN;
  END IF;
  IF p_request_id IS NULL OR issue_id IS NULL OR length(issue_id)>100 OR nullif(trim(p_issue->>'description'),'') IS NULL THEN RAISE EXCEPTION 'Issue ID, request ID and description are required'; END IF;
  IF severity NOT IN ('Low','Normal','High','Emergency','Critical') THEN RAISE EXCEPTION 'Invalid priority'; END IF;
  IF issue_status NOT IN ('New','Acknowledged','Assigned','In progress','Waiting on customer','Waiting on third party','Resolved','Closed') THEN RAISE EXCEPTION 'Invalid issue status'; END IF;
  SELECT * INTO owner FROM public.employees WHERE id = p_issue->>'assignedEmployeeId' AND is_active;
  IF owner.id IS NULL THEN RAISE EXCEPTION 'Assign an active employee'; END IF;
  IF nullif(p_issue->>'followUpDeadline','') IS NULL THEN RAISE EXCEPTION 'Response deadline is required'; END IF;
  deadline := (p_issue->>'followUpDeadline')::timestamptz;
  IF (SELECT count(DISTINCT lower(email)) FROM public.user_profiles WHERE lower(email) IN ('jorgejr@crtroofing.com','natalia@crtroofing.com')) <> 2 THEN
    RAISE EXCEPTION 'Jorge and Natalia notification profiles must be configured';
  END IF;
  issues := coalesce(job.job_payload->'issues','[]'::jsonb);
  SELECT value INTO old_issue FROM jsonb_array_elements(issues) WHERE value->>'id' = issue_id;
  IF old_issue IS NOT NULL AND (p_expected_updated_at IS DISTINCT FROM old_issue->>'updatedAt') THEN
    RAISE EXCEPTION 'This issue changed. Refresh the job and review the latest issue before saving.' USING ERRCODE = '40001';
  END IF;
  IF old_issue IS NULL AND p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'Issue no longer exists'; END IF;
  IF old_issue IS NULL AND deadline <= now_at THEN RAISE EXCEPTION 'Choose a future response deadline'; END IF;
  IF old_issue IS NULL AND issue_status IN ('Resolved','Closed') THEN RAISE EXCEPTION 'Report the issue before confirming resolution'; END IF;
  IF issue_status IN ('Resolved','Closed') AND (nullif(trim(p_issue->>'resolutionNote'),'') IS NULL OR coalesce(p_issue->>'resolutionConfirmed','false') <> 'true') THEN
    RAISE EXCEPTION 'Confirm resolution and describe the completed correction';
  END IF;
  -- Critical issues must receive a response within an hour of escalation.
  IF severity IN ('Critical','Emergency') THEN
    deadline := least(deadline, CASE WHEN old_issue->>'priority' IN ('Critical','Emergency') AND old_issue->>'status' NOT IN ('Resolved','Closed') THEN coalesce((old_issue->>'escalatedAt')::timestamptz,now_at) ELSE now_at END + interval '1 hour');
  END IF;
  saved_issue := coalesce(old_issue,'{}'::jsonb) || jsonb_build_object(
    'id',issue_id,'issueNumber',coalesce(old_issue->>'issueNumber','ISS-'||left(replace(p_request_id::text,'-',''),12)),
    'projectId',job.job_payload->>'id','description',trim(p_issue->>'description'),
    'category',coalesce(p_issue->>'category','Other'),'priority',severity,'status',issue_status,
    'assignedEmployeeId',owner.id,'assignedEmployeeName',coalesce(owner.display_name,owner.employee_name,concat_ws(' ',owner.first_name,owner.last_name)),
    'followUpDeadline',deadline,'callerName',coalesce(p_issue->>'callerName',''),'callerCompany',coalesce(p_issue->>'callerCompany',''),
    'phone',coalesce(p_issue->>'phone',''),'email',coalesce(p_issue->>'email',''),'dateTime',coalesce(p_issue->>'dateTime',now_at::text),
    'reason',coalesce(p_issue->>'reason',''),'response',coalesce(p_issue->>'response',''),
    'createdAt',coalesce(old_issue->>'createdAt',now_at::text),'updatedAt',now_at,
    'resolutionNote',CASE WHEN issue_status IN ('Resolved','Closed') THEN trim(p_issue->>'resolutionNote') ELSE NULL END,
    'resolvedAt',CASE WHEN issue_status IN ('Resolved','Closed') THEN now_at ELSE NULL END,
    'resolvedBy',CASE WHEN issue_status IN ('Resolved','Closed') THEN actor.id ELSE NULL END,
    'escalatedAt',CASE WHEN severity IN ('Critical','Emergency') AND (coalesce(old_issue->>'priority','') NOT IN ('Critical','Emergency') OR old_issue->>'status' IN ('Resolved','Closed')) THEN now_at::text WHEN severity IN ('Critical','Emergency','High') THEN coalesce(old_issue->>'escalatedAt',now_at::text) ELSE old_issue->>'escalatedAt' END);
  IF old_issue IS NULL THEN issues := issues || jsonb_build_array(saved_issue);
  ELSE SELECT jsonb_agg(CASE WHEN value->>'id'=issue_id THEN saved_issue ELSE value END ORDER BY ordinal) INTO issues FROM jsonb_array_elements(issues) WITH ORDINALITY AS items(value,ordinal); END IF;
  event_action := CASE WHEN old_issue IS NULL THEN 'reported' WHEN issue_status IN ('Resolved','Closed') THEN 'resolved' WHEN old_issue->>'status' IN ('Resolved','Closed') THEN 'reopened' ELSE 'updated' END;
  INSERT INTO public.job_issue_audit(request_id,source_record_uid,issue_id,actor_id,action,request_payload,before_issue,after_issue)
  VALUES(p_request_id,p_source_record_uid,issue_id,actor.id,event_action,p_issue,old_issue,saved_issue);
  PERFORM set_config('crt.issue_rpc','on',true);
  UPDATE public.active_jobs SET job_payload = coalesce(job_payload,'{}'::jsonb) || jsonb_build_object(
      'riskLevel',CASE WHEN severity IN ('High','Emergency','Critical') AND issue_status NOT IN ('Resolved','Closed') THEN 'Critical' ELSE coalesce(job.job_payload->>'riskLevel',job.risk_level,'Normal') END,
      'issues',issues,'openIssuesCount',(SELECT count(*) FROM jsonb_array_elements(issues) WHERE lower(coalesce(value->>'status','')) NOT IN ('resolved','closed')),
      'activityLog', jsonb_build_array(jsonb_build_object('id',p_request_id,'summary','Issue '||(saved_issue->>'issueNumber')||' '||event_action,'changedBy',actor.full_name,'createdAt',now_at)) || coalesce(job_payload->'activityLog','[]'::jsonb)),
    risk_level = CASE WHEN severity IN ('High','Emergency','Critical') AND issue_status NOT IN ('Resolved','Closed') THEN 'Critical' ELSE risk_level END,
    updated_at=now_at,updated_by=actor.id::text
  WHERE id=job.id RETURNING * INTO job;
  PERFORM set_config('crt.issue_rpc','off',true);
  INSERT INTO public.workflow_notifications(event_key,user_id,source_record_uid,kind,message)
  SELECT p_request_id::text,profile.id,p_source_record_uid,'issue_'||event_action,
    severity||' issue '||(saved_issue->>'issueNumber')||' '||event_action||' — '||coalesce(job.project_name,job.job_name,'Job')||'. Owner: '||(saved_issue->>'assignedEmployeeName')||'. Response due: '||deadline::text
  FROM public.user_profiles profile WHERE lower(profile.email) IN ('jorgejr@crtroofing.com','natalia@crtroofing.com',lower(owner.email))
  ON CONFLICT DO NOTHING;
  RETURN NEXT job;
END;
$$;
REVOKE ALL ON FUNCTION public.save_active_job_issue(text,jsonb,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_active_job_issue(text,jsonb,uuid,text) TO authenticated;

-- Stale general job saves must never replace issue history. All issue writes use the locked RPC.
CREATE FUNCTION public.protect_active_job_issues() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF current_setting('crt.issue_rpc',true) IS DISTINCT FROM 'on' THEN
    IF TG_OP='UPDATE' THEN
      NEW.job_payload := coalesce(NEW.job_payload,'{}'::jsonb) || jsonb_build_object('issues',coalesce(OLD.job_payload->'issues','[]'::jsonb),'openIssuesCount',coalesce(OLD.job_payload->'openIssuesCount','0'::jsonb));
    ELSIF coalesce(NEW.job_payload->'issues','[]'::jsonb) <> '[]'::jsonb THEN
      RAISE EXCEPTION 'Create the job first, then report issues through the issue workflow';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(NEW.job_payload->'issues','[]'::jsonb)) WHERE value->>'priority' IN ('High','Critical','Emergency') AND lower(coalesce(value->>'status','')) NOT IN ('resolved','closed')) THEN
    NEW.risk_level := 'Critical';
    NEW.job_payload := jsonb_set(NEW.job_payload,'{riskLevel}','"Critical"'::jsonb,true);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_active_job_issues BEFORE INSERT OR UPDATE ON public.active_jobs FOR EACH ROW EXECUTE FUNCTION public.protect_active_job_issues();
COMMIT;
