BEGIN;

-- Exactly one durable outcome per processed call.
ALTER TABLE public.phone_intake_events ADD COLUMN task_id uuid UNIQUE REFERENCES public.company_tasks(id);
DO $$DECLARE c record;BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.phone_intake_events'::regclass
 AND contype='c' AND pg_get_constraintdef(oid) LIKE '%processing_status%' AND pg_get_constraintdef(oid) LIKE '%inspection_request_id%' LOOP
  EXECUTE format('ALTER TABLE public.phone_intake_events DROP CONSTRAINT %I',c.conname);
 END LOOP;
END$$;
ALTER TABLE public.phone_intake_events ADD CONSTRAINT phone_intake_outcome_check CHECK (
 (processing_status='processed' AND num_nonnulls(inspection_request_id,task_id)=1)
 OR (processing_status<>'processed' AND num_nonnulls(inspection_request_id,task_id)=0));

-- Internal helper. The service RPC owns receipt locking and rollback.
CREATE FUNCTION public.create_retell_message_task(p_call jsonb)
RETURNS public.company_tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 fields jsonb := p_call->'call_analysis'->'custom_analysis_data';
 route text := fields->>'message_route';
 recipient_email text;
 recipient uuid;
 actor uuid;
 matches integer;
 field_name text;
 description_text text;
 result public.company_tasks;
 previous_sub text := current_setting('request.jwt.claim.sub',true);
 previous_claims text := current_setting('request.jwt.claims',true);
BEGIN
 FOREACH field_name IN ARRAY ARRAY['caller_name','callback_number','email_address','property_address','reason_for_call','urgency_status','requested_timing','requested_employee','message_route'] LOOP
  IF fields ? field_name AND jsonb_typeof(fields->field_name) NOT IN ('string','null') THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Message fields must be text';
  END IF;
 END LOOP;
 IF route IS NULL OR route NOT IN ('General Message','Contract Question') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='A General Message or Contract Question route is required for non-estimate calls';
 END IF;
 IF trim(coalesce(fields->>'reason_for_call',''))='' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='A caller message is required';
 END IF;
 IF jsonb_typeof(p_call->'call_analysis'->'call_summary') NOT IN ('string','null') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Call summary must be text';
 END IF;
 recipient_email := CASE route WHEN 'Contract Question' THEN 'daniela@crtroofing.com' ELSE 'natalia@crtroofing.com' END;
 SELECT count(*),(array_agg(id))[1] INTO matches,recipient FROM public.user_profiles WHERE lower(trim(email))=recipient_email;
 IF matches<>1 THEN RAISE EXCEPTION 'Message recipient % must resolve uniquely',recipient_email; END IF;
 SELECT i.user_id INTO actor FROM public.phone_intake_identity i
 JOIN public.user_profiles p ON p.id=i.user_id JOIN auth.users u ON u.id=p.id
 WHERE i.provider='retell' AND p.full_name='AI Phone' AND p.role='salesperson'
 AND p.email='ai-phone@automation.crtroofing.invalid' AND u.banned_until>now();
 IF actor IS NULL OR actor=recipient THEN RAISE EXCEPTION 'Provision the disabled AI Phone automation identity'; END IF;
 description_text := concat_ws(E'\n','Source: AI Phone','Retell call ID: '||(p_call->>'call_id'),
 'Message route: '||route,
 'Caller: '||coalesce(nullif(trim(fields->>'caller_name'),''),'Not provided'),
 'Callback: '||coalesce(nullif(trim(fields->>'callback_number'),''),'Not provided'),
 'Email: '||coalesce(nullif(trim(fields->>'email_address'),''),'Not provided'),
 'Property address: '||coalesce(nullif(trim(fields->>'property_address'),''),'Not provided'),
 'Message: '||(fields->>'reason_for_call'),
 'Reported urgency: '||coalesce(fields->>'urgency_status',''),
 'Requested timing (preference, not an appointment): '||coalesce(fields->>'requested_timing',''),
 'Requested employee (caller preference): '||coalesce(fields->>'requested_employee',''),
 'AI call summary: '||coalesce(p_call->'call_analysis'->>'call_summary',''));
 IF length(description_text)>30000 OR length(fields->>'caller_name')>300 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Message exceeds task limits';
 END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','service_role')::text,true);
 SELECT * INTO result FROM public.create_private_company_task(
 'AI Phone - '||route||': '||coalesce(nullif(trim(fields->>'caller_name'),''),'Caller name not provided'),
 description_text,NULL,
 CASE WHEN fields->>'urgency_status' IN ('Active Leak / Water Intrusion','Other Urgent Condition') THEN 'high' ELSE 'normal' END,
 ARRAY[recipient]);
 PERFORM set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 PERFORM set_config('request.jwt.claims',coalesce(previous_claims,''),true);
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.create_retell_message_task(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.process_retell_call(p_call jsonb)
RETURNS public.phone_intake_events LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 receipt public.phone_intake_events;
 r public.inspection_requests;
 message_task public.company_tasks;
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
   ELSIF fields->>'call_type'<>'New Estimate' OR fields->>'message_route'='Contract Question' THEN
    SELECT * INTO message_task FROM public.create_retell_message_task(p_call);
    UPDATE public.phone_intake_events SET processing_status='processed',task_id=message_task.id WHERE id=receipt.id;
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
   error_code=failure_code,error_details=left(SQLERRM,2000),inspection_request_id=NULL,task_id=NULL WHERE id=receipt.id;
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
