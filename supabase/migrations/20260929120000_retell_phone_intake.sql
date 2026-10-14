BEGIN;

-- Operational delivery ledger only. Customer work remains in inspection_requests.
CREATE TABLE public.phone_intake_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider text NOT NULL CHECK(provider='retell'),
 event_type text NOT NULL CHECK(event_type='call_analyzed'),
 external_call_id text NOT NULL CHECK(length(external_call_id) BETWEEN 1 AND 200),
 received_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 processing_status text NOT NULL DEFAULT 'received'
   CHECK(processing_status IN ('received','processed','ignored','needs_review','failed')),
 call_data jsonb NOT NULL CHECK(jsonb_typeof(call_data)='object'),
 inspection_request_id uuid UNIQUE REFERENCES public.inspection_requests(id),
 attempts integer NOT NULL DEFAULT 0,
 error_code text NOT NULL DEFAULT '',
 error_details text NOT NULL DEFAULT '',
 UNIQUE(provider,event_type,external_call_id),
 UNIQUE(provider,external_call_id),
 CHECK((processing_status='processed') = (inspection_request_id IS NOT NULL))
);
CREATE INDEX phone_intake_review_idx ON public.phone_intake_events(processing_status,received_at);
ALTER TABLE public.phone_intake_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phone_intake_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.phone_intake_events TO service_role;
GRANT SELECT ON public.phone_intake_events TO authenticated;
CREATE POLICY phone_intake_office_read ON public.phone_intake_events FOR SELECT TO authenticated
 USING(public.is_proposal_manager());

-- Provisioned once by scripts/provision-ai-phone.mjs. Not an employee login.
CREATE TABLE public.phone_intake_identity (
 provider text PRIMARY KEY CHECK(provider='retell'),
 user_id uuid NOT NULL UNIQUE REFERENCES public.user_profiles(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_intake_identity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phone_intake_identity FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.phone_intake_identity TO service_role;

-- Shared submission implementation, identical to the manual lifecycle except
-- for trusted source/service inputs. No client may call this internal function.
CREATE OR REPLACE FUNCTION public.submit_inspection_request_internal(p_id uuid,p_expected_version integer,p_source text,p_service text)
RETURNS public.inspection_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.inspection_requests;t public.company_tasks;actor public.user_profiles;new_lead uuid;
BEGIN
 SELECT * INTO r FROM public.inspection_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR r.created_by<>auth.uid() THEN RAISE EXCEPTION 'Only the creator can submit this draft'; END IF;
 IF r.status<>'draft' THEN RETURN r; END IF;
 IF r.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'This draft changed. Reload before sending.'; END IF;
 IF trim(r.contact_name)='' OR (trim(r.phone)='' AND trim(r.email)='' AND trim(r.property_address)='') THEN RAISE EXCEPTION 'Enter a contact name and phone, email, or address'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=r.assigned_to) THEN RAISE EXCEPTION 'Assign a provisioned technician'; END IF;
 SELECT * INTO actor FROM public.user_profiles WHERE id=auth.uid();
 new_lead:=r.lead_id;
 IF new_lead IS NULL THEN
  new_lead:=gen_random_uuid();
  INSERT INTO public.crm_leads(id,created_by,originator_id,originator_name,originator_email,relationship_owner_id,assigned_staff_id,
  contact_name,phone,email,property_address,lead_source,service_needed,quick_note,status,qualification_status,qualified_at,qualified_by,accepted_for_inspection_at,accepted_for_inspection_by,updated_by)
  VALUES(new_lead,auth.uid(),auth.uid(),coalesce(actor.full_name,''),coalesce(actor.email,''),auth.uid(),r.assigned_to::text,
  r.contact_name,r.phone,r.email,r.property_address,p_source,p_service,r.notes,'Inspection Requested','qualified',now(),auth.uid(),now(),auth.uid(),auth.uid());
 END IF;
 UPDATE public.inspection_requests SET lead_id=new_lead WHERE id=p_id;
 SELECT * INTO t FROM public.create_inspection_request_task(new_lead,'Inspection Request: '||r.contact_name,
 concat_ws(E'\n','Please contact this customer to schedule a roof inspection.','Contact: '||r.contact_name,'Phone: '||r.phone,'Email: '||r.email,
 'Property address: '||r.property_address,'Best time to call: '||r.best_time_to_call,'Inspection notes: '||r.notes,'Open the Inspection Request Center for photos, files and scheduling.','CRM lead ID: '||new_lead),
 CASE WHEN r.urgency IN ('High','Urgent') THEN 'high' ELSE 'normal' END,r.assigned_to);
 UPDATE public.inspection_requests SET status='new',lead_id=new_lead,task_id=t.id,submitted_at=now(),updated_at=now(),version=version+1 WHERE id=p_id RETURNING * INTO r;
 RETURN r;
END;$$;
REVOKE ALL ON FUNCTION public.submit_inspection_request_internal(uuid,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.submit_inspection_request(p_id uuid,p_expected_version integer)
RETURNS public.inspection_requests LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.submit_inspection_request_internal(p_id,p_expected_version,'Phone Call / Office','Roof inspection');
$$;
REVOKE ALL ON FUNCTION public.submit_inspection_request(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_inspection_request(uuid,integer) TO authenticated;

-- Only the verified Edge Function's service role can enter this adapter.
-- No caller-controlled actor, assignee, source, appointment or inspection ID.
CREATE FUNCTION public.process_retell_call(p_call jsonb)
RETURNS public.phone_intake_events LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 receipt public.phone_intake_events;
 r public.inspection_requests;
 fields jsonb;
 actor uuid;
 technician uuid;
 matches integer;
 call_id text;
 notes_text text;
 urgency_text text;
 field_name text;
 previous_sub text := current_setting('request.jwt.claim.sub',true);
 previous_claims text := current_setting('request.jwt.claims',true);
 failure_code text;
BEGIN
 IF p_call IS NULL OR jsonb_typeof(p_call)<>'object' THEN RAISE EXCEPTION 'Invalid call object'; END IF;
 call_id := p_call->>'call_id';
 IF jsonb_typeof(p_call->'call_id') IS DISTINCT FROM 'string' OR length(trim(call_id)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid call ID'; END IF;
 IF octet_length(p_call::text)>100000 THEN RAISE EXCEPTION 'Selected call data too large'; END IF;
 -- The lock handles concurrent attempts; both unique constraints remain the backstop.
 PERFORM pg_advisory_xact_lock(hashtextextended('retell:'||call_id,0));
 INSERT INTO public.phone_intake_events(provider,event_type,external_call_id,call_data)
 VALUES('retell','call_analyzed',call_id,p_call) ON CONFLICT(provider,external_call_id) DO NOTHING;
 SELECT * INTO receipt FROM public.phone_intake_events WHERE provider='retell' AND external_call_id=call_id FOR UPDATE;
 IF receipt.processing_status IN ('processed','ignored','needs_review') THEN RETURN receipt; END IF;
 -- Retries use the original durable data, not a later altered analysis payload.
 p_call := receipt.call_data;
 UPDATE public.phone_intake_events SET attempts=attempts+1,updated_at=now(),error_code='',error_details='' WHERE id=receipt.id;
 BEGIN
  IF p_call->>'call_type' IS DISTINCT FROM 'phone_call' OR p_call->>'direction' IS DISTINCT FROM 'inbound' THEN
   UPDATE public.phone_intake_events SET processing_status='ignored',error_details='Not an inbound phone call' WHERE id=receipt.id;
  ELSE
   fields := p_call->'call_analysis'->'custom_analysis_data';
   IF jsonb_typeof(fields) IS DISTINCT FROM 'object' OR jsonb_typeof(fields->'call_type') IS DISTINCT FROM 'string' OR trim(fields->>'call_type')='' THEN
    UPDATE public.phone_intake_events SET processing_status='needs_review',error_code='missing_classification',error_details='Post-call classification is missing' WHERE id=receipt.id;
   ELSIF fields->>'call_type'<>'New Estimate' THEN
    UPDATE public.phone_intake_events SET processing_status='ignored',error_details='Not a New Estimate call' WHERE id=receipt.id;
   ELSE
    FOREACH field_name IN ARRAY ARRAY['caller_name','callback_number','email_address','property_address','property_type','reason_for_call','urgency_status','requested_timing','requested_employee','roofing_work_requested'] LOOP
     IF fields ? field_name AND jsonb_typeof(fields->field_name) NOT IN ('string','null') THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Extracted fields must be text';
     END IF;
    END LOOP;
    IF jsonb_typeof(p_call->'call_analysis'->'call_summary') NOT IN ('string','null') THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Call summary must be text';
    END IF;
    IF trim(coalesce(fields->>'caller_name',''))='' OR (
      trim(coalesce(fields->>'callback_number',''))='' AND trim(coalesce(fields->>'email_address',''))='' AND trim(coalesce(fields->>'property_address',''))='') THEN
     UPDATE public.phone_intake_events SET processing_status='needs_review',error_code='incomplete_customer',
      error_details='A caller name and at least one of callback number, email or address are required' WHERE id=receipt.id;
    ELSE
     IF length(fields->>'caller_name')>300 OR length(fields->>'callback_number')>100 OR length(fields->>'email_address')>300 OR length(fields->>'property_address')>1000 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Customer fields exceed inspection limits';
     END IF;
     SELECT count(*),(array_agg(id))[1] INTO matches,technician FROM public.user_profiles WHERE lower(trim(email))='ivan@crtroofing.com';
     IF matches<>1 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='Ivan profile must resolve uniquely'; END IF;
     IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=technician AND lower(role) IN ('salesperson','estimator','admin','cfo')) THEN
      RAISE EXCEPTION 'Ivan profile must have a supported technician role';
     END IF;
     SELECT i.user_id INTO actor FROM public.phone_intake_identity i
      JOIN public.user_profiles p ON p.id=i.user_id JOIN auth.users u ON u.id=p.id
      WHERE i.provider='retell' AND p.full_name='AI Phone' AND p.role='salesperson'
       AND p.email='ai-phone@automation.crtroofing.invalid' AND u.banned_until>now();
     IF actor IS NULL OR actor=technician THEN RAISE EXCEPTION 'Provision the disabled AI Phone automation identity'; END IF;
     urgency_text := CASE fields->>'urgency_status'
      WHEN 'Active Leak / Water Intrusion' THEN 'Urgent'
      WHEN 'Other Urgent Condition' THEN 'High' ELSE 'Normal' END;
     notes_text := concat_ws(E'\n',
      'Source: AI Phone','Retell call ID: '||call_id,
      'Property type: '||coalesce(fields->>'property_type',''),
      'Roofing work requested: '||coalesce(fields->>'roofing_work_requested',''),
      'Reason for call: '||coalesce(fields->>'reason_for_call',''),
      'Reported urgency: '||coalesce(fields->>'urgency_status',''),
      'Requested timing (preference, not an appointment): '||coalesce(fields->>'requested_timing',''),
      'Requested employee (caller preference): '||coalesce(fields->>'requested_employee',''),
      'AI call summary: '||coalesce(p_call->'call_analysis'->>'call_summary',''));
     IF length(notes_text)>30000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Call context exceeds inspection notes limit'; END IF;
     -- Transaction-local attribution to the dedicated non-login account lets us
     -- reuse ALL existing lifecycle checks, audit and assignment triggers.
     PERFORM set_config('request.jwt.claim.sub',actor::text,true);
     PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','service_role')::text,true);
     SELECT * INTO r FROM public.save_inspection_request(gen_random_uuid(),jsonb_build_object(
      'contact_name',trim(fields->>'caller_name'),'phone',trim(coalesce(fields->>'callback_number','')),
      'email',trim(coalesce(fields->>'email_address','')),'property_address',trim(coalesce(fields->>'property_address','')),
      'notes',notes_text,'urgency',urgency_text,'assigned_to',technician),0);
     SELECT * INTO r FROM public.submit_inspection_request_internal(r.id,r.version,'AI Phone',
      coalesce(nullif(trim(fields->>'roofing_work_requested'),''),'Roof inspection'));
     PERFORM set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
     PERFORM set_config('request.jwt.claims',coalesce(previous_claims,''),true);
     UPDATE public.phone_intake_events SET processing_status='processed',inspection_request_id=r.id WHERE id=receipt.id;
    END IF;
   END IF;
  END IF;
 EXCEPTION WHEN OTHERS THEN
  -- This subtransaction rolls back the inspection, CRM, tasks, audit and
  -- notifications together; the outer delivery/error record is retained.
  GET STACKED DIAGNOSTICS failure_code=RETURNED_SQLSTATE;
  UPDATE public.phone_intake_events SET
   processing_status=CASE WHEN failure_code='22023' THEN 'needs_review' ELSE 'failed' END,
   error_code=failure_code,error_details=left(SQLERRM,2000),inspection_request_id=NULL WHERE id=receipt.id;
 END;
 -- Also restore on the exception path, before this connection returns to pool.
 PERFORM set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 PERFORM set_config('request.jwt.claims',coalesce(previous_claims,''),true);
 SELECT * INTO receipt FROM public.phone_intake_events WHERE id=receipt.id;
 RETURN receipt;
END;$$;
REVOKE ALL ON FUNCTION public.process_retell_call(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_retell_call(jsonb) TO service_role;
COMMIT;
