-- Preserve Ivan's source transcript, the structured extraction, and his explicit
-- confirmation. The AI service never writes directly to the database.
ALTER TABLE public.proposal_requests
  ADD COLUMN IF NOT EXISTS inspection_transcript text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS inspection_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS inspection_extraction jsonb NOT NULL DEFAULT '{"fields":[],"missing_critical":[],"needs_confirmation":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS inspection_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS inspection_confirmed_by uuid REFERENCES public.user_profiles(id);

ALTER TABLE public.proposal_requests DROP CONSTRAINT IF EXISTS proposal_requests_inspection_transcript_size_check;
ALTER TABLE public.proposal_requests ADD CONSTRAINT proposal_requests_inspection_transcript_size_check
  CHECK (length(inspection_transcript) <= 100000);

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
  IF NOT p_confirmed THEN RAISE EXCEPTION 'Ivan must confirm the extracted inspection information before it can be saved'; END IF;
  IF length(trim(coalesce(p_transcript,'')))<40 THEN RAISE EXCEPTION 'A PLAUD summary or transcript is required'; END IF;
  IF length(p_transcript)>100000 THEN RAISE EXCEPTION 'The transcript is too long'; END IF;
  IF jsonb_typeof(coalesce(p_extraction,'{}'::jsonb))<>'object'
    OR jsonb_typeof(coalesce(p_extraction->'fields','[]'::jsonb))<>'array' THEN
    RAISE EXCEPTION 'The structured extraction is invalid';
  END IF;
  SELECT * INTO request FROM public.proposal_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_proposal_request(p_request_id) THEN RAISE EXCEPTION 'Proposal request not found'; END IF;
  IF NOT public.is_proposal_manager() AND request.salesperson_id<>auth.uid() AND request.created_by<>auth.uid() THEN
    RAISE EXCEPTION 'Only the assigned salesperson can confirm this inspection';
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
    'Salesperson reviewed and confirmed the AI-organized PLAUD inspection handoff.',
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
