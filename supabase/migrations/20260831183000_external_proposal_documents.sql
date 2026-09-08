-- Proposal Requests manage externally-authored Word/PDF documents.
-- Customer-facing proposals are prepared outside the app; the app controls
-- version history, approvals, signed documents, and production authorization.

ALTER TABLE public.proposal_versions
  ADD COLUMN IF NOT EXISTS source_document_storage_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_document_file_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS final_pdf_storage_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS final_pdf_file_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS signed_pdf_storage_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS signed_pdf_file_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.save_external_proposal_version(
  p_request_id uuid,
  p_sections jsonb,
  p_source_document_path text,
  p_source_document_name text,
  p_final_pdf_path text DEFAULT '',
  p_final_pdf_name text DEFAULT '',
  p_finalize boolean DEFAULT false
)
RETURNS public.proposal_versions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE version public.proposal_versions; next_number integer;
BEGIN
  IF NOT (public.is_company_estimator() OR public.is_proposal_manager()) OR NOT public.can_access_proposal_request(p_request_id) THEN RAISE EXCEPTION 'Estimator access required'; END IF;
  IF jsonb_typeof(p_sections)<>'array' OR jsonb_array_length(p_sections)=0 THEN RAISE EXCEPTION 'At least one proposal section is required'; END IF;
  IF trim(coalesce(p_source_document_path,''))='' OR lower(trim(coalesce(p_source_document_name,''))) NOT LIKE '%.docx' THEN RAISE EXCEPTION 'A Word .docx proposal is required'; END IF;
  IF p_source_document_path NOT LIKE p_request_id::text||'/%' THEN RAISE EXCEPTION 'Word document path does not match Proposal Request'; END IF;
  IF p_finalize AND (trim(coalesce(p_final_pdf_path,''))='' OR lower(trim(coalesce(p_final_pdf_name,''))) NOT LIKE '%.pdf') THEN RAISE EXCEPTION 'A finalized PDF is required for Sales Review'; END IF;
  IF trim(coalesce(p_final_pdf_path,''))<>'' AND p_final_pdf_path NOT LIKE p_request_id::text||'/%' THEN RAISE EXCEPTION 'Final PDF path does not match Proposal Request'; END IF;
  SELECT coalesce(max(version_number),0)+1 INTO next_number FROM public.proposal_versions WHERE proposal_request_id=p_request_id;
  INSERT INTO public.proposal_versions(
    proposal_request_id,version_number,pdf_storage_path,sections,
    source_document_storage_path,source_document_file_name,final_pdf_storage_path,final_pdf_file_name,
    finalized_at,finalized_by
  ) VALUES(
    p_request_id,next_number,coalesce(p_final_pdf_path,''),p_sections,
    trim(p_source_document_path),trim(p_source_document_name),trim(coalesce(p_final_pdf_path,'')),trim(coalesce(p_final_pdf_name,'')),
    CASE WHEN p_finalize THEN now() END,CASE WHEN p_finalize THEN auth.uid() END
  ) RETURNING * INTO version;
  UPDATE public.proposal_requests SET status=CASE WHEN p_finalize THEN 'sales_review' ELSE 'drafting_proposal' END,updated_at=now() WHERE id=p_request_id;
  PERFORM public.queue_proposal_notification(p_request_id,(SELECT salesperson_id FROM public.proposal_requests WHERE id=p_request_id),'sales_review',CASE WHEN p_finalize THEN 'Final proposal PDF is ready for Sales Review.' ELSE 'A Word proposal version was uploaded.' END);
  PERFORM public.write_proposal_audit(p_request_id,CASE WHEN p_finalize THEN 'proposal_finalized' ELSE 'proposal_drafted' END,'External document version '||next_number,version.id,jsonb_build_object('word_file',p_source_document_name,'pdf_file',p_final_pdf_name));
  RETURN version;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_external_proposal_sent(p_version_id uuid)
RETURNS public.proposal_versions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE version public.proposal_versions; request public.proposal_requests;
BEGIN
  IF NOT (public.is_company_estimator() OR public.is_proposal_manager()) THEN RAISE EXCEPTION 'Estimator or management access required'; END IF;
  SELECT * INTO version FROM public.proposal_versions WHERE id=p_version_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_proposal_request(version.proposal_request_id) THEN RAISE EXCEPTION 'Proposal version not found'; END IF;
  IF version.sales_approved_at IS NULL THEN RAISE EXCEPTION 'Salesperson approval is required before sending'; END IF;
  IF trim(version.final_pdf_storage_path)='' THEN RAISE EXCEPTION 'Final proposal PDF is required before sending'; END IF;
  SELECT * INTO request FROM public.proposal_requests WHERE id=version.proposal_request_id;
  UPDATE public.proposal_versions SET sent_at=coalesce(sent_at,now()),delivery_method='external',updated_at=now() WHERE id=version.id RETURNING * INTO version;
  UPDATE public.proposal_requests SET status='sent',sent_at=coalesce(sent_at,now()),updated_at=now() WHERE id=request.id;
  PERFORM public.queue_proposal_notification(request.id,request.salesperson_id,'proposal_sent','Proposal was sent to the customer outside the app.');
  PERFORM public.write_proposal_audit(request.id,'proposal_sent','Final PDF sent externally',version.id,jsonb_build_object('delivery_method','external'));
  RETURN version;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_external_proposal_execution(
  p_version_id uuid,
  p_customer_name text,
  p_signed_pdf_path text,
  p_signed_pdf_name text,
  p_approved_section_ids text[],
  p_customer_signed_at timestamptz DEFAULT now()
)
RETURNS public.proposal_versions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE version public.proposal_versions; request public.proposal_requests; selected_sections jsonb;
BEGIN
  IF NOT (public.is_company_estimator() OR public.is_proposal_manager()) THEN RAISE EXCEPTION 'Estimator or management access required'; END IF;
  SELECT * INTO version FROM public.proposal_versions WHERE id=p_version_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_proposal_request(version.proposal_request_id) THEN RAISE EXCEPTION 'Proposal version not found'; END IF;
  IF version.sales_approved_at IS NULL OR version.sent_at IS NULL THEN RAISE EXCEPTION 'Sales approval and sent status are required'; END IF;
  IF trim(coalesce(p_customer_name,''))='' THEN RAISE EXCEPTION 'Customer signer name is required'; END IF;
  IF trim(coalesce(p_signed_pdf_path,''))='' OR lower(trim(coalesce(p_signed_pdf_name,''))) NOT LIKE '%.pdf' THEN RAISE EXCEPTION 'Signed proposal PDF is required'; END IF;
  IF p_signed_pdf_path NOT LIKE version.proposal_request_id::text||'/%' THEN RAISE EXCEPTION 'Signed PDF path does not match Proposal Request'; END IF;
  IF cardinality(coalesce(p_approved_section_ids,'{}'))=0 THEN RAISE EXCEPTION 'At least one approved section is required'; END IF;
  SELECT coalesce(jsonb_agg(section),'[]'::jsonb) INTO selected_sections FROM jsonb_array_elements(version.sections) section WHERE section->>'id'=ANY(p_approved_section_ids);
  IF jsonb_array_length(selected_sections)<>cardinality(p_approved_section_ids) THEN RAISE EXCEPTION 'Unknown proposal section selected'; END IF;
  SELECT * INTO request FROM public.proposal_requests WHERE id=version.proposal_request_id FOR UPDATE;
  UPDATE public.proposal_versions SET
    sections=(SELECT jsonb_agg(section||jsonb_build_object('customer_approved',(section->>'id'=ANY(p_approved_section_ids)))) FROM jsonb_array_elements(version.sections) section),
    customer_decision='signed',customer_name=trim(p_customer_name),signed_pdf_storage_path=trim(p_signed_pdf_path),signed_pdf_file_name=trim(p_signed_pdf_name),
    customer_signature_storage_path=trim(p_signed_pdf_path),customer_signed_at=coalesce(p_customer_signed_at,now()),updated_at=now()
  WHERE id=version.id RETURNING * INTO version;
  UPDATE public.proposal_requests SET status='signed',signed_at=version.customer_signed_at,
    production_scope=jsonb_build_object(
      'authorized',(SELECT coalesce(jsonb_agg(s),'[]'::jsonb) FROM jsonb_array_elements(version.sections) s WHERE coalesce((s->>'customer_approved')::boolean,false)),
      'not_authorized',(SELECT coalesce(jsonb_agg(s),'[]'::jsonb) FROM jsonb_array_elements(version.sections) s WHERE NOT coalesce((s->>'customer_approved')::boolean,false))
    ),production_scope_generated_at=now(),updated_at=now()
  WHERE id=request.id;
  PERFORM public.write_proposal_audit(request.id,'customer_signed','Externally signed PDF uploaded for '||trim(p_customer_name),version.id,jsonb_build_object('signed_file',p_signed_pdf_name,'approved_section_ids',p_approved_section_ids));
  INSERT INTO public.proposal_request_notifications(proposal_request_id,user_id,actor_id,notification_type,message)
  SELECT request.id,recipient,auth.uid(),'proposal_signed','Signed proposal PDF recorded for version '||version.version_number||'.' FROM (SELECT request.salesperson_id recipient UNION SELECT request.assigned_estimator_id) recipients WHERE recipient IS NOT NULL AND recipient<>auth.uid();
  RETURN version;
END;
$$;

-- Keep the production gate server-side and require the executed document itself.
CREATE OR REPLACE FUNCTION public.release_proposal_to_production(p_request_id uuid,p_override_reason text DEFAULT '')
RETURNS public.proposal_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE request public.proposal_requests; version public.proposal_versions; blockers text[]:='{}'; override_used boolean:=false; new_job_id uuid; new_source_id text;
BEGIN
  IF NOT (public.is_company_estimator() OR public.is_proposal_manager()) THEN RAISE EXCEPTION 'Estimator or management access required'; END IF;
  SELECT * INTO request FROM public.proposal_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_proposal_request(p_request_id) THEN RAISE EXCEPTION 'Proposal request not found'; END IF;
  IF request.production_released_at IS NOT NULL THEN RETURN request; END IF;
  SELECT * INTO version FROM public.proposal_versions WHERE proposal_request_id=p_request_id ORDER BY version_number DESC LIMIT 1;
  IF version.finalized_at IS NULL OR trim(coalesce(version.final_pdf_storage_path,''))='' THEN blockers:=array_append(blockers,'Proposal not finalized'); END IF;
  IF version.sales_approved_at IS NULL THEN blockers:=array_append(blockers,'Salesperson scope approval missing'); END IF;
  IF version.customer_decision<>'signed' OR version.customer_signed_at IS NULL THEN blockers:=array_append(blockers,'Customer signature missing'); END IF;
  IF trim(coalesce(version.signed_pdf_storage_path,''))='' THEN blockers:=array_append(blockers,'Signed proposal document missing'); END IF;
  IF request.production_scope_generated_at IS NULL OR jsonb_array_length(coalesce(request.production_scope->'authorized','[]'::jsonb))=0 THEN blockers:=array_append(blockers,'Authorized production scope missing'); END IF;
  IF request.deposit_required AND request.deposit_satisfied_at IS NULL THEN blockers:=array_append(blockers,'Required deposit not received'); END IF;
  IF EXISTS(SELECT 1 FROM public.proposal_change_orders WHERE proposal_request_id=p_request_id AND required_for_release AND status<>'signed') THEN blockers:=array_append(blockers,'Required change order not signed'); END IF;
  IF cardinality(blockers)>0 THEN
    IF NOT public.is_proposal_manager() OR trim(coalesce(p_override_reason,''))='' THEN RAISE EXCEPTION 'BLOCKED FROM PRODUCTION: %',array_to_string(blockers,'; '); END IF;
    override_used:=true;
  END IF;
  new_job_id:=gen_random_uuid(); new_source_id:='job:proposal-request:'||request.id;
  INSERT INTO public.active_jobs(id,user_key,source_record_uid,workflow_status,estimate_id,local_estimate_id,job_number,job_name,project_name,customer_name,customer,address,job_address,status,contract_amount,final_bid,project_contact,is_active,created_at,updated_at,updated_by,proposal_request_id,production_authorized_at,production_authorized_by,production_authorization_source,job_payload)
  VALUES(new_job_id,auth.uid()::text,new_source_id,'approved',version.estimate_id,version.estimate_id,'PR-'||request.request_number,request.property_name,request.property_name,request.customer_name,request.customer_name,request.service_address,request.service_address,'Ready for Production',coalesce(request.target_price,0),coalesce(request.target_price,0),request.customer_contact,true,now(),now(),auth.uid()::text,request.id,now(),auth.uid(),CASE WHEN override_used THEN 'admin_override' ELSE 'signed_proposal' END,
    jsonb_build_object('proposalRequestId',request.id,'proposalVersionId',version.id,'signedProposalPath',version.signed_pdf_storage_path,'workflowStatus','approved','status','Ready for Production','projectStatus','Ready for Production','projectName',request.property_name,'customerName',request.customer_name,'projectAddress',request.service_address,'projectContact',concat_ws(' ',request.project_contact_first_name,request.project_contact_last_name),'projectContactPhone',request.project_contact_phone,'projectContactEmail',request.project_contact_email,'authorizedScope',request.production_scope->'authorized','notAuthorizedScope',request.production_scope->'not_authorized','productionGateOverride',override_used))
  ON CONFLICT(source_record_uid) DO UPDATE SET job_payload=EXCLUDED.job_payload,status=EXCLUDED.status,updated_at=now(),updated_by=auth.uid()::text RETURNING id INTO new_job_id;
  UPDATE public.proposal_requests SET production_released_at=now(),production_released_by=auth.uid(),production_override_reason=CASE WHEN override_used THEN trim(p_override_reason) ELSE '' END,active_job_id=new_job_id,updated_at=now() WHERE id=p_request_id RETURNING * INTO request;
  PERFORM public.write_proposal_audit(request.id,CASE WHEN override_used THEN 'production_override' ELSE 'production_released' END,CASE WHEN override_used THEN p_override_reason ELSE 'All release controls satisfied' END,version.id,jsonb_build_object('blockers',blockers,'active_job_id',new_job_id));
  IF override_used THEN
    INSERT INTO public.proposal_request_notifications(proposal_request_id,user_id,actor_id,notification_type,message)
    SELECT request.id,id,auth.uid(),'production_override','Production gate overridden: '||p_override_reason FROM public.user_profiles WHERE lower(role) IN ('admin','cfo') AND id<>auth.uid();
  END IF;
  RETURN request;
END;
$$;

REVOKE ALL ON FUNCTION public.save_external_proposal_version(uuid,jsonb,text,text,text,text,boolean),public.mark_external_proposal_sent(uuid),public.record_external_proposal_execution(uuid,text,text,text,text[],timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_external_proposal_version(uuid,jsonb,text,text,text,text,boolean),public.mark_external_proposal_sent(uuid),public.record_external_proposal_execution(uuid,text,text,text,text[],timestamptz) TO authenticated;

