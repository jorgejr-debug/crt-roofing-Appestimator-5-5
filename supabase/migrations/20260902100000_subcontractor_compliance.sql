BEGIN;

CREATE OR REPLACE FUNCTION public.can_manage_subcontractor_compliance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles profile
    WHERE profile.id=auth.uid()
      AND (lower(coalesce(profile.role,'')) IN ('admin','cfo') OR lower(coalesce(profile.email,''))='natalia@crtroofing.com')
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_subcontractor_compliance() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_subcontractor_compliance() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_subcontractor_directory()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles profile
    WHERE profile.id=auth.uid()
      AND lower(coalesce(profile.role,'')) IN ('admin','cfo','estimator','salesperson')
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_subcontractor_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_view_subcontractor_directory() TO authenticated;

CREATE TABLE public.subcontractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  trade text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  license_status text NOT NULL CHECK (license_status IN ('licensed','unlicensed')),
  license_number text NOT NULL DEFAULT '',
  license_expiration_date date,
  workers_comp_active boolean NOT NULL DEFAULT false,
  workers_comp_expiration_date date,
  coi_names_crt_insured boolean NOT NULL DEFAULT false,
  coi_storage_path text NOT NULL DEFAULT '',
  coi_file_name text NOT NULL DEFAULT '',
  coi_uploaded_at timestamptz,
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) DEFAULT auth.uid(),
  updated_by uuid NOT NULL REFERENCES public.user_profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subcontractor_license_number_required CHECK (license_status='unlicensed' OR trim(license_number)<>''),
  CONSTRAINT subcontractor_workers_comp_expiration_required CHECK (NOT workers_comp_active OR workers_comp_expiration_date IS NOT NULL)
);
CREATE UNIQUE INDEX subcontractors_company_name_unique ON public.subcontractors(lower(trim(company_name)));
CREATE INDEX subcontractors_compliance_expiration_idx ON public.subcontractors(is_active,workers_comp_expiration_date);

CREATE TABLE public.subcontractor_compliance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  expiration_date date NOT NULL,
  notification_window text NOT NULL CHECK (notification_window IN ('30_day','14_day','7_day','expired')),
  days_remaining integer NOT NULL,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed','skipped')),
  email_sent_at timestamptz,
  email_error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subcontractor_id,expiration_date,notification_window)
);

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_compliance_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY subcontractors_manage_compliance ON public.subcontractors FOR ALL TO authenticated USING (public.can_manage_subcontractor_compliance()) WITH CHECK (public.can_manage_subcontractor_compliance());
CREATE POLICY subcontractors_read_active_directory ON public.subcontractors FOR SELECT TO authenticated USING (is_active AND public.can_view_subcontractor_directory());
CREATE POLICY subcontractor_notifications_read ON public.subcontractor_compliance_notifications FOR SELECT TO authenticated USING (public.can_manage_subcontractor_compliance());

CREATE OR REPLACE FUNCTION public.enqueue_subcontractor_compliance_notifications(p_today date DEFAULT current_date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE inserted_count integer;
BEGIN
  INSERT INTO public.subcontractor_compliance_notifications(subcontractor_id,expiration_date,notification_window,days_remaining)
  SELECT id,workers_comp_expiration_date,
    CASE
      WHEN workers_comp_expiration_date<p_today THEN 'expired'
      WHEN workers_comp_expiration_date<=p_today+7 THEN '7_day'
      WHEN workers_comp_expiration_date<=p_today+14 THEN '14_day'
      ELSE '30_day'
    END,
    workers_comp_expiration_date-p_today
  FROM public.subcontractors
  WHERE is_active AND workers_comp_active
    AND workers_comp_expiration_date BETWEEN p_today-30 AND p_today+30
  ON CONFLICT(subcontractor_id,expiration_date,notification_window) DO NOTHING;
  GET DIAGNOSTICS inserted_count=ROW_COUNT;
  RETURN inserted_count;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_subcontractor_compliance_notifications(date) FROM PUBLIC,anon,authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES(
  'subcontractor-coi','subcontractor-coi',false,15728640,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
) ON CONFLICT(id) DO UPDATE SET public=EXCLUDED.public,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE POLICY subcontractor_coi_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='subcontractor-coi' AND public.can_manage_subcontractor_compliance());
CREATE POLICY subcontractor_coi_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='subcontractor-coi' AND public.can_manage_subcontractor_compliance() AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY subcontractor_coi_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='subcontractor-coi' AND public.can_manage_subcontractor_compliance()) WITH CHECK(bucket_id='subcontractor-coi' AND public.can_manage_subcontractor_compliance());

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $$
DECLARE existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname='subcontractor-compliance-daily' LIMIT 1;
  IF existing_job IS NOT NULL THEN PERFORM cron.unschedule(existing_job); END IF;
  PERFORM cron.schedule('subcontractor-compliance-daily','0 15 * * *','SELECT public.enqueue_subcontractor_compliance_notifications(current_date);');
END;
$$;

COMMIT;
