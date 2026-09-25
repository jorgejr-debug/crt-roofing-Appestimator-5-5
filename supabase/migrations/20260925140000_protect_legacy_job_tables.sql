BEGIN;
-- Preserve existing shared access for provisioned company accounts while
-- removing unauthenticated access to the three legacy operational tables.
CREATE FUNCTION public.can_access_legacy_job_records()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.can_access_legacy_job_records() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_legacy_job_records() TO authenticated;
ALTER TABLE public.approved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completed_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completed_job_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.approved_jobs,public.completed_jobs,public.completed_job_metrics FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.approved_jobs,public.completed_jobs,public.completed_job_metrics TO authenticated;
GRANT ALL ON public.approved_jobs,public.completed_jobs,public.completed_job_metrics TO service_role;
CREATE POLICY company_member_legacy_jobs ON public.approved_jobs FOR ALL TO authenticated
 USING(public.can_access_legacy_job_records()) WITH CHECK(public.can_access_legacy_job_records());
CREATE POLICY company_member_legacy_jobs ON public.completed_jobs FOR ALL TO authenticated
 USING(public.can_access_legacy_job_records()) WITH CHECK(public.can_access_legacy_job_records());
CREATE POLICY company_member_legacy_jobs ON public.completed_job_metrics FOR ALL TO authenticated
 USING(public.can_access_legacy_job_records()) WITH CHECK(public.can_access_legacy_job_records());
COMMIT;
