BEGIN;

CREATE TABLE IF NOT EXISTS public.proposal_request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_request_id uuid NOT NULL REFERENCES public.proposal_requests(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.user_profiles(id),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposal_request_comments_request_idx
  ON public.proposal_request_comments(proposal_request_id,created_at);

ALTER TABLE public.proposal_request_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proposal_comments_select_participants ON public.proposal_request_comments;
CREATE POLICY proposal_comments_select_participants
ON public.proposal_request_comments
FOR SELECT TO authenticated
USING (public.can_access_proposal_request(proposal_request_id));

CREATE OR REPLACE FUNCTION public.add_proposal_request_comment(
  p_request_id uuid,
  p_body text
)
RETURNS public.proposal_request_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  request public.proposal_requests;
  new_comment public.proposal_request_comments;
  estimator uuid;
  recipient uuid;
  recipients uuid[]:='{}'::uuid[];
  notification_message text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.can_access_proposal_request(p_request_id) THEN RAISE EXCEPTION 'Proposal request not found'; END IF;
  IF length(trim(coalesce(p_body,''))) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Comment must be between 1 and 4000 characters';
  END IF;

  SELECT * INTO request FROM public.proposal_requests WHERE id=p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal request not found'; END IF;

  INSERT INTO public.proposal_request_comments(proposal_request_id,author_id,body)
  VALUES(p_request_id,auth.uid(),trim(p_body))
  RETURNING * INTO new_comment;

  estimator:=request.assigned_estimator_id;
  IF estimator IS NULL THEN
    SELECT id INTO estimator FROM public.user_profiles
    WHERE lower(email)='daniela@crtroofing.com' AND is_active=true LIMIT 1;
  END IF;

  IF auth.uid()=request.salesperson_id OR auth.uid()=request.created_by THEN
    recipients:=array_append(recipients,estimator);
  ELSIF auth.uid()=estimator OR public.is_company_estimator() THEN
    recipients:=array_append(recipients,request.salesperson_id);
    recipients:=array_append(recipients,request.created_by);
  ELSE
    recipients:=array_append(recipients,request.salesperson_id);
    recipients:=array_append(recipients,request.created_by);
    recipients:=array_append(recipients,estimator);
  END IF;

  notification_message:='New comment: '||new_comment.body;
  FOR recipient IN
    SELECT DISTINCT candidate
    FROM unnest(recipients) AS recipient_list(candidate)
    WHERE candidate IS NOT NULL AND candidate<>auth.uid()
  LOOP
    INSERT INTO public.proposal_request_notifications(
      proposal_request_id,user_id,actor_id,notification_type,message
    ) VALUES(
      p_request_id,recipient,auth.uid(),'comment_added',notification_message
    );
  END LOOP;

  PERFORM public.write_proposal_audit(
    p_request_id,
    'comment_added',
    'A proposal conversation comment was added.',
    NULL,
    jsonb_build_object('comment_id',new_comment.id)
  );

  RETURN new_comment;
END;
$$;

REVOKE ALL ON TABLE public.proposal_request_comments FROM PUBLIC,anon;
GRANT SELECT ON TABLE public.proposal_request_comments TO authenticated;
REVOKE ALL ON FUNCTION public.add_proposal_request_comment(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_proposal_request_comment(uuid,text) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_request_comments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

COMMIT;
