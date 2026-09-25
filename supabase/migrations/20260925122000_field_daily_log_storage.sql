BEGIN;
-- The production project has no field-log tables. Preserve each complete log
-- atomically so an interrupted save cannot leave partially replaced child rows.
CREATE TABLE public.field_daily_logs (
 id text PRIMARY KEY,
 user_key text NOT NULL,
 job_number text NOT NULL DEFAULT '',
 work_date date NOT NULL,
 status text NOT NULL CHECK(status IN ('draft','submitted')),
 log_payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX field_daily_logs_owner_date ON public.field_daily_logs(user_key,work_date);
ALTER TABLE public.field_daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY field_daily_logs_read ON public.field_daily_logs FOR SELECT TO authenticated USING(user_key=auth.uid()::text);
REVOKE ALL ON public.field_daily_logs FROM anon,authenticated;
GRANT SELECT ON public.field_daily_logs TO authenticated;
GRANT ALL ON public.field_daily_logs TO service_role;
CREATE FUNCTION public.save_field_daily_log(p_log jsonb,p_expected_updated_at timestamptz DEFAULT NULL)
RETURNS SETOF public.field_daily_logs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE existing public.field_daily_logs%ROWTYPE; saved public.field_daily_logs%ROWTYPE;
 actor uuid:=auth.uid(); payload jsonb:=p_log-'serverUpdatedAt'; log_id text:=p_log->>'id'; log_status text:=p_log->>'status';
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=actor) THEN RAISE EXCEPTION 'Sign in with your company account' USING ERRCODE='42501'; END IF;
 IF nullif(log_id,'') IS NULL OR length(log_id)>120 OR log_status NOT IN ('draft','submitted') OR nullif(p_log->>'workDate','') IS NULL THEN RAISE EXCEPTION 'Log ID, date and valid status are required'; END IF;
 IF octet_length(p_log::text)>2000000 THEN RAISE EXCEPTION 'Upload photos separately before saving this log'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(log_id,0));
 SELECT * INTO existing FROM public.field_daily_logs WHERE id=log_id FOR UPDATE;
 IF existing.id IS NOT NULL THEN
   IF existing.user_key<>actor::text THEN RAISE EXCEPTION 'This log belongs to another employee' USING ERRCODE='42501'; END IF;
   IF existing.log_payload=payload THEN RETURN NEXT existing; RETURN; END IF;
   IF existing.status='submitted' THEN RAISE EXCEPTION 'Submitted logs are locked. Create a correction instead.'; END IF;
   IF existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'This draft changed on another device. Reload it before saving.' USING ERRCODE='40001'; END IF;
 ELSIF p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'The saved draft could not be found';
 END IF;
 IF nullif(payload->>'correctionOfLogId','') IS NOT NULL AND (nullif(trim(payload->>'correctionReason'),'') IS NULL OR NOT EXISTS(SELECT 1 FROM public.field_daily_logs WHERE id=payload->>'correctionOfLogId' AND user_key=actor::text AND status='submitted')) THEN RAISE EXCEPTION 'Select your submitted log and describe the correction'; END IF;
 IF log_status='submitted' THEN
   IF nullif(trim(payload->>'jobNumber'),'') IS NULL OR nullif(trim(payload->>'workCompleted'),'') IS NULL THEN RAISE EXCEPTION 'Job number and completed work are required'; END IF;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(payload->'photos','[]'::jsonb)) photo WHERE photo->>'photoCategory' IN ('progress','completed') AND nullif(photo->>'storagePath','') IS NOT NULL) THEN RAISE EXCEPTION 'Upload a progress or completed-work photo before submission'; END IF;
 END IF;
 INSERT INTO public.field_daily_logs(id,user_key,job_number,work_date,status,log_payload)
 VALUES(log_id,actor::text,coalesce(payload->>'jobNumber',''),(payload->>'workDate')::date,log_status,payload)
 ON CONFLICT(id) DO UPDATE SET job_number=excluded.job_number,work_date=excluded.work_date,status=excluded.status,log_payload=excluded.log_payload,updated_at=clock_timestamp()
 RETURNING * INTO saved;
 RETURN NEXT saved;
END; $$;
REVOKE ALL ON FUNCTION public.save_field_daily_log(jsonb,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_field_daily_log(jsonb,timestamptz) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('field-daily-log-photos','field-daily-log-photos',false,20971520,ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY field_log_photos_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='field-daily-log-photos' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY field_log_photos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='field-daily-log-photos' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY field_log_photos_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='field-daily-log-photos' AND (storage.foldername(name))[1]=auth.uid()::text) WITH CHECK(bucket_id='field-daily-log-photos' AND (storage.foldername(name))[1]=auth.uid()::text);
COMMIT;
