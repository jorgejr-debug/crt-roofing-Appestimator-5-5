BEGIN;
CREATE OR REPLACE FUNCTION public.save_inspection_request(p_id uuid,p_payload jsonb,p_expected_version integer DEFAULT 0)
RETURNS public.inspection_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.inspection_requests; technician uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_use_crm() THEN RAISE EXCEPTION 'Inspection request access required'; END IF;
 IF p_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'Invalid request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO r FROM public.inspection_requests WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF NOT public.can_edit_inspection_request(p_id) THEN RAISE EXCEPTION 'Request access required'; END IF;
  IF r.status IN ('proposal_requested','cancelled') THEN RAISE EXCEPTION 'This request is closed for editing'; END IF;
  IF r.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'This request changed. Reload before saving.' USING ERRCODE='40001'; END IF;
 ELSE
  IF p_expected_version<>0 THEN RAISE EXCEPTION 'Saved request not found'; END IF;
  SELECT id INTO technician FROM public.user_profiles WHERE lower(email)='ivan@crtroofing.com' LIMIT 1;
  INSERT INTO public.inspection_requests(id,created_by,assigned_to) VALUES(p_id,auth.uid(),technician) RETURNING * INTO r;
 END IF;
 technician:=coalesce(nullif(p_payload->>'assigned_to','')::uuid,r.assigned_to);
 IF technician IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=technician AND lower(role) IN ('salesperson','estimator','admin','cfo')) THEN RAISE EXCEPTION 'Choose a provisioned sales technician'; END IF;
 IF technician IS DISTINCT FROM r.assigned_to AND NOT public.is_proposal_manager() AND r.status<>'draft' THEN RAISE EXCEPTION 'Office staff must reassign submitted inspections'; END IF;
 UPDATE public.inspection_requests SET contact_name=left(coalesce(p_payload->>'contact_name',r.contact_name),300),
 phone=left(coalesce(p_payload->>'phone',r.phone),100),email=left(coalesce(p_payload->>'email',r.email),300),
 property_address=left(coalesce(p_payload->>'property_address',r.property_address),1000),best_time_to_call=left(coalesce(p_payload->>'best_time_to_call',r.best_time_to_call),300),
 urgency=coalesce(p_payload->>'urgency',r.urgency),notes=left(coalesce(p_payload->>'notes',r.notes),30000),
 findings=left(coalesce(p_payload->>'findings',r.findings),30000),measurements=left(coalesce(p_payload->>'measurements',r.measurements),10000),
 assigned_to=technician,appointment_at=CASE WHEN p_payload ? 'appointment_at' THEN nullif(p_payload->>'appointment_at','')::timestamptz ELSE r.appointment_at END,
 updated_at=now(),version=version+1 WHERE id=p_id RETURNING * INTO r;
 RETURN r;
END;$$;

CREATE OR REPLACE FUNCTION public.submit_inspection_request(p_id uuid,p_expected_version integer)
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
  r.contact_name,r.phone,r.email,r.property_address,'Phone Call / Office','Roof inspection',r.notes,'Inspection Requested','qualified',now(),auth.uid(),now(),auth.uid(),auth.uid());
 END IF;
 UPDATE public.inspection_requests SET lead_id=new_lead WHERE id=p_id;
 SELECT * INTO t FROM public.create_inspection_request_task(new_lead,'Inspection Request: '||r.contact_name,
 concat_ws(E'\n','Please contact this customer to schedule a roof inspection.','Contact: '||r.contact_name,'Phone: '||r.phone,'Email: '||r.email,
 'Property address: '||r.property_address,'Best time to call: '||r.best_time_to_call,'Inspection notes: '||r.notes,'Open the Inspection Request Center for photos, files and scheduling.','CRM lead ID: '||new_lead),
 CASE WHEN r.urgency IN ('High','Urgent') THEN 'high' ELSE 'normal' END,r.assigned_to);
 UPDATE public.inspection_requests SET status='new',lead_id=new_lead,task_id=t.id,submitted_at=now(),updated_at=now(),version=version+1 WHERE id=p_id RETURNING * INTO r;
 RETURN r;
END;$$;
COMMIT;
