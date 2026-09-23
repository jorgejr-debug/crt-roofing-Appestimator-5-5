-- Generalize the inspection confirmation language because authorized inspectors
-- beyond Ivan may create a handoff. Authorization remains tied to the request
-- owner/creator or a proposal manager, and the confirmer is recorded separately.
CREATE OR REPLACE FUNCTION public.save_confirmed_inspection_extraction(
  p_request_id uuid,
  p_transcript text,
  p_summary text,
  p_extraction jsonb,
  p_confirmed boolean
)
RETURNS public.proposal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE request public.proposal_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT p_confirmed THEN RAISE EXCEPTION 'The inspector must confirm the extracted inspection information before it can be saved'; END IF;
  IF length(trim(coalesce(p_transcript,'')))<40 THEN RAISE EXCEPTION 'A PLAUD summary or transcript is required'; END IF;
  IF length(p_transcript)>100000 THEN RAISE EXCEPTION 'The transcript is too long'; END IF;
  IF jsonb_typeof(coalesce(p_extraction,'{}'::jsonb))<>'object'
    OR jsonb_typeof(coalesce(p_extraction->'fields','[]'::jsonb))<>'array' THEN
    RAISE EXCEPTION 'The structured extraction is invalid';
  END IF;
  SELECT * INTO request FROM public.proposal_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_proposal_request(p_request_id) THEN RAISE EXCEPTION 'Proposal request not found'; END IF;
  IF NOT public.is_proposal_manager() AND request.salesperson_id<>auth.uid() AND request.created_by<>auth.uid() THEN
    RAISE EXCEPTION 'Only the assigned salesperson or inspector can confirm this inspection';
  END IF;
  IF request.status NOT IN ('draft','missing_information') THEN RAISE EXCEPTION 'Only a draft or returned handoff can be confirmed'; END IF;
  UPDATE public.proposal_requests SET
    inspection_transcript=trim(p_transcript),
    inspection_summary=trim(coalesce(p_summary,'')),
    inspection_extraction=coalesce(p_extraction,'{}'::jsonb),
    inspection_confirmed_at=now(),
    inspection_confirmed_by=auth.uid(),
    updated_at=now()
  WHERE id=p_request_id RETURNING * INTO request;
  PERFORM public.write_proposal_audit(
    request.id,
    'inspection_extraction_confirmed',
    'Inspector reviewed and confirmed the AI-organized PLAUD inspection handoff.',
    NULL,
    jsonb_build_object(
      'field_count',jsonb_array_length(coalesce(p_extraction->'fields','[]'::jsonb)),
      'missing_critical',coalesce(p_extraction->'missing_critical','[]'::jsonb),
      'needs_confirmation',coalesce(p_extraction->'needs_confirmation','[]'::jsonb)
    )
  );
  RETURN request;
END;
$$;

REVOKE ALL ON FUNCTION public.save_confirmed_inspection_extraction(uuid,text,text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_confirmed_inspection_extraction(uuid,text,text,jsonb,boolean) TO authenticated;
