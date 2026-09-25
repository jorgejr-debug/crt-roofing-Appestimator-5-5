BEGIN;
-- Office review is read-only. Employee drafts and all write restrictions remain unchanged.
CREATE FUNCTION public.can_review_submitted_field_logs()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND lower(role) IN ('admin','cfo'));
$$;
REVOKE ALL ON FUNCTION public.can_review_submitted_field_logs() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_review_submitted_field_logs() TO authenticated;
CREATE POLICY field_daily_logs_office_read ON public.field_daily_logs
 FOR SELECT TO authenticated USING(status='submitted' AND public.can_review_submitted_field_logs());
-- Only files referenced by a submitted log owned by that same uploader become
-- visible to office reviewers. Draft, orphan and unrelated bucket files stay private.
CREATE POLICY field_log_photos_office_read ON storage.objects
 FOR SELECT TO authenticated USING(
 bucket_id='field-daily-log-photos'
 AND public.can_review_submitted_field_logs()
 AND EXISTS(
   SELECT 1 FROM public.field_daily_logs log
   WHERE log.status='submitted' AND log.user_key=(storage.foldername(storage.objects.name))[1]
   AND (log.log_payload->'photos' @> jsonb_build_array(jsonb_build_object('storagePath',storage.objects.name))
     OR log.log_payload->'fuelReceipts' @> jsonb_build_array(jsonb_build_object('receiptPhotoPath',storage.objects.name)))
 )
);
COMMIT;
