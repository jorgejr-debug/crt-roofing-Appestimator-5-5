BEGIN;

-- Owner oversight is SELECT-only. Do not broaden can_access_company_task:
-- that helper also authorizes status changes, comments and file writes.
CREATE FUNCTION public.can_review_all_company_tasks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.user_profiles p JOIN auth.users u ON u.id=p.id
  WHERE p.id=auth.uid() AND lower(trim(u.email))='jorgejr@crtroofing.com'
  AND lower(trim(p.role)) IN ('admin','cfo')
 );
$$;
REVOKE ALL ON FUNCTION public.can_review_all_company_tasks() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_review_all_company_tasks() TO authenticated;

CREATE POLICY company_tasks_owner_read ON public.company_tasks
 FOR SELECT TO authenticated USING(public.can_review_all_company_tasks());
CREATE POLICY company_task_assignees_owner_read ON public.company_task_assignees
 FOR SELECT TO authenticated USING(public.can_review_all_company_tasks());
CREATE POLICY company_task_comments_owner_read ON public.company_task_comments
 FOR SELECT TO authenticated USING(public.can_review_all_company_tasks());
COMMIT;
