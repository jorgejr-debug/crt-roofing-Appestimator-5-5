-- Read-only production compatibility review. Makes no schema or data changes.
BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
  'checked_at', now(),
  'existing_intake_objects', jsonb_build_object(
    'events', to_regclass('public.phone_intake_events')::text,
    'identity', to_regclass('public.phone_intake_identity')::text,
    'processor', to_regprocedure('public.process_retell_call(jsonb)')::text
  ),
  'ivan_profiles', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'full_name', full_name, 'email', email, 'role', role
  )), '[]'::jsonb) FROM public.user_profiles
    WHERE lower(trim(email)) = 'ivan@crtroofing.com'),
  'automation_profiles', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'full_name', full_name, 'email', email, 'role', role
  )), '[]'::jsonb) FROM public.user_profiles
    WHERE lower(trim(email)) = 'ai-phone@automation.crtroofing.invalid'),
  'columns', (SELECT jsonb_agg(jsonb_build_object(
    'table', table_name, 'column', column_name, 'type', udt_name,
    'nullable', is_nullable, 'default', column_default
  ) ORDER BY table_name, ordinal_position)
    FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name IN ('inspection_requests','crm_leads','company_tasks',
      'company_task_assignees','user_profiles')),
  'functions', (SELECT jsonb_agg(jsonb_build_object(
    'name', p.proname, 'arguments', pg_get_function_identity_arguments(p.oid),
    'definition', pg_get_functiondef(p.oid), 'acl', p.proacl::text
  ) ORDER BY p.proname, p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'save_inspection_request','submit_inspection_request',
      'submit_inspection_request_internal','create_inspection_request_task',
      'is_proposal_manager','process_retell_call')),
  'triggers', (SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname, 'name', t.tgname, 'enabled', t.tgenabled,
    'definition', pg_get_triggerdef(t.oid)
  ) ORDER BY c.relname, t.tgname)
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
    AND c.relname IN ('inspection_requests','crm_leads','company_tasks',
      'company_task_assignees','user_profiles'))
) AS production_preflight;
COMMIT;
