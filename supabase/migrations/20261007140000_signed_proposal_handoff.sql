BEGIN;
CREATE TABLE public.signed_proposal_handoffs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_record_uid text NOT NULL UNIQUE,
 storage_path text NOT NULL UNIQUE,
 file_name text NOT NULL,
 uploaded_by uuid NOT NULL REFERENCES public.user_profiles(id),
 uploaded_at timestamptz NOT NULL DEFAULT now(),
 acknowledged_by uuid REFERENCES public.user_profiles(id),
 acknowledged_at timestamptz
);
ALTER TABLE public.signed_proposal_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signed_proposal_handoffs FROM anon, authenticated;
GRANT SELECT ON public.signed_proposal_handoffs TO authenticated;
GRANT ALL ON public.signed_proposal_handoffs TO service_role;
CREATE FUNCTION public.can_read_signed_proposals() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id=auth.uid() AND (lower(role) IN ('admin','cfo','project_manager') OR lower(email) IN ('daniela@crtroofing.com','ivan@crtroofing.com')))
$$;
REVOKE ALL ON FUNCTION public.can_read_signed_proposals() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_signed_proposals() TO authenticated;
CREATE POLICY signed_proposals_read ON public.signed_proposal_handoffs FOR SELECT TO authenticated USING(public.can_read_signed_proposals());
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('signed-proposals','signed-proposals',false,15728640,ARRAY['application/pdf','image/jpeg','image/png']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY signed_proposals_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='signed-proposals' AND (storage.foldername(name))[1]=auth.uid()::text AND public.can_read_signed_proposals()
 AND EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND (lower(role) IN ('admin','cfo') OR lower(email) IN ('daniela@crtroofing.com','ivan@crtroofing.com'))));
CREATE POLICY signed_proposals_download ON storage.objects FOR SELECT TO authenticated USING(bucket_id='signed-proposals' AND public.can_read_signed_proposals());
-- Immutable documents: no authenticated update/delete policy, so an acknowledged file cannot be swapped.
CREATE FUNCTION public.register_signed_proposal(p_source text,p_path text,p_name text,p_confirmed boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=auth.uid() AND (lower(role) IN ('admin','cfo') OR lower(email) IN ('daniela@crtroofing.com','ivan@crtroofing.com'))) THEN RAISE EXCEPTION 'Office approval access required'; END IF;
 IF p_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm the customer signature, scope and agreed price before uploading'; END IF;
 IF coalesce(p_source,'') NOT LIKE 'job:%' OR nullif(trim(p_name),'') IS NULL THEN RAISE EXCEPTION 'A job and file name are required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='signed-proposals' AND name=p_path AND split_part(name,'/',1)=auth.uid()::text) THEN RAISE EXCEPTION 'Upload the signed proposal first'; END IF;
 INSERT INTO signed_proposal_handoffs(source_record_uid,storage_path,file_name,uploaded_by) VALUES(p_source,p_path,p_name,auth.uid()) RETURNING id INTO result;
 IF EXISTS(SELECT 1 FROM active_jobs WHERE source_record_uid=p_source AND workflow_status IN ('approved','active')) THEN
 INSERT INTO workflow_notifications(event_key,user_id,source_record_uid,kind,message)
 SELECT 'signed_proposal:'||result::text,id,p_source,'signed_proposal_ready','Signed proposal ready. Review and acknowledge receipt: https://crt-roofing-estimator.vercel.app/?signedProposal='||result::text
 FROM user_profiles WHERE lower(trim(email))='miguel@crtroofing.com' ON CONFLICT(event_key,user_id) DO NOTHING;
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.acknowledge_signed_proposal(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=auth.uid() AND lower(trim(email))='miguel@crtroofing.com') THEN RAISE EXCEPTION 'Only Miguel can acknowledge this handoff'; END IF;
 UPDATE signed_proposal_handoffs h SET acknowledged_by=auth.uid(),acknowledged_at=now()
 WHERE h.id=p_id AND h.acknowledged_at IS NULL AND EXISTS(SELECT 1 FROM active_jobs j WHERE j.source_record_uid=h.source_record_uid AND j.workflow_status IN ('approved','active','completed'));
 IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM signed_proposal_handoffs WHERE id=p_id AND acknowledged_by=auth.uid()) THEN RAISE EXCEPTION 'Approved job handoff not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.register_signed_proposal(text,text,text,boolean),public.acknowledge_signed_proposal(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_signed_proposal(text,text,text,boolean),public.acknowledge_signed_proposal(uuid) TO authenticated;

-- Preserve existing jobs without silently approving new jobs with missing documents.
CREATE TABLE public.legacy_approved_job_sources(source_record_uid text PRIMARY KEY);
INSERT INTO public.legacy_approved_job_sources SELECT DISTINCT source_record_uid FROM public.active_jobs WHERE source_record_uid IS NOT NULL;
REVOKE ALL ON public.legacy_approved_job_sources FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.require_signed_proposal_for_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.workflow_status IN ('approved','active','completed') AND NOT EXISTS(SELECT 1 FROM legacy_approved_job_sources WHERE source_record_uid=NEW.source_record_uid)
 AND NOT EXISTS(SELECT 1 FROM signed_proposal_handoffs WHERE source_record_uid=NEW.source_record_uid) THEN
 RAISE EXCEPTION 'Upload and confirm the signed customer proposal before approving this job';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.require_signed_proposal_for_approval() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_signed_proposal_for_approval BEFORE INSERT OR UPDATE ON public.active_jobs FOR EACH ROW EXECUTE FUNCTION public.require_signed_proposal_for_approval();

CREATE OR REPLACE FUNCTION public.notify_miguel_job_approved() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE recipient_id uuid; document_id uuid;
BEGIN
 IF lower(coalesce(NEW.workflow_status,'')) <> 'approved' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN IF lower(coalesce(OLD.workflow_status,''))='approved' THEN RETURN NEW; END IF; END IF;
 SELECT id INTO STRICT recipient_id FROM public.user_profiles WHERE lower(trim(email))='miguel@crtroofing.com';
 SELECT id INTO document_id FROM public.signed_proposal_handoffs WHERE source_record_uid=NEW.source_record_uid;
 INSERT INTO public.workflow_notifications(event_key,user_id,source_record_uid,kind,message)
 VALUES('job_approved:'||NEW.id::text,recipient_id,coalesce(NEW.source_record_uid,'job:'||NEW.id::text),'job_approved',
 'A job has been approved: '||coalesce(nullif(trim(NEW.project_name),''),nullif(trim(NEW.job_name),''),'Unnamed job')||'. '||
 CASE WHEN document_id IS NOT NULL THEN 'Review the signed proposal and acknowledge receipt: https://crt-roofing-estimator.vercel.app/?signedProposal='||document_id::text ELSE 'Open Approved Jobs in CRT Roofing to review it.' END)
 ON CONFLICT(event_key,user_id) DO NOTHING;
 RETURN NEW;
END $$;
COMMIT;
