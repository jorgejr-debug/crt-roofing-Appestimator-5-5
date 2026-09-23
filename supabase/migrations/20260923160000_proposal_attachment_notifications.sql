BEGIN;

CREATE OR REPLACE FUNCTION public.notify_proposal_attachment_batch(
  p_request_id uuid,
  p_attachment_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  request public.proposal_requests;
  attachment_count integer:=0;
  attachment_names text:='';
  recipient uuid;
  recipients uuid[]:='{}'::uuid[];
  estimator uuid;
  message_text text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.can_access_proposal_request(p_request_id) THEN RAISE EXCEPTION 'Proposal request not found'; END IF;

  SELECT * INTO request FROM public.proposal_requests WHERE id=p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal request not found'; END IF;

  SELECT count(*),string_agg(file_name,', ' ORDER BY created_at)
  INTO attachment_count,attachment_names
  FROM public.proposal_request_attachments
  WHERE proposal_request_id=p_request_id
    AND id=ANY(coalesce(p_attachment_ids,'{}'::uuid[]))
    AND uploaded_by=auth.uid();

  IF attachment_count=0 THEN RAISE EXCEPTION 'No newly uploaded attachments were found'; END IF;

  -- Draft editing remains quiet. Submitted handoffs, accepted drafts, and returned
  -- requests notify the counterpart only after attachment registration succeeds.
  IF request.status='draft' AND coalesce(request.draft_handoff_status,'') NOT IN ('awaiting_review','accepted') THEN
    RETURN 0;
  END IF;

  estimator:=request.assigned_estimator_id;
  IF estimator IS NULL THEN
    SELECT id INTO estimator FROM public.user_profiles
    WHERE lower(email)='daniela@crtroofing.com' AND is_active=true LIMIT 1;
  END IF;

  IF auth.uid()=request.salesperson_id OR auth.uid()=request.created_by THEN
    recipients:=array_append(recipients,estimator);
  ELSIF auth.uid()=estimator OR public.is_company_estimator() THEN
    recipients:=array_append(recipients,request.salesperson_id);
  ELSE
    recipients:=array_append(recipients,request.salesperson_id);
    recipients:=array_append(recipients,estimator);
  END IF;

  message_text:=attachment_count||' attachment'||CASE WHEN attachment_count=1 THEN '' ELSE 's' END||
    ' uploaded: '||coalesce(attachment_names,'');

  FOR recipient IN
    SELECT DISTINCT candidate
    FROM unnest(recipients) AS recipient_list(candidate)
    WHERE candidate IS NOT NULL AND candidate<>auth.uid()
  LOOP
    INSERT INTO public.proposal_request_notifications(
      proposal_request_id,user_id,actor_id,notification_type,message
    ) VALUES(
      p_request_id,recipient,auth.uid(),'attachments_uploaded',message_text
    );
  END LOOP;

  PERFORM public.write_proposal_audit(
    p_request_id,
    'attachment_batch_notified',
    message_text,
    NULL,
    jsonb_build_object(
      'attachment_ids',to_jsonb(p_attachment_ids),
      'attachment_count',attachment_count
    )
  );

  RETURN attachment_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_proposal_attachment_batch(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.notify_proposal_attachment_batch(uuid,uuid[]) TO authenticated;

COMMIT;
