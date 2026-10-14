-- Read-only compatibility check before deploying message routing.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'recipients',(SELECT jsonb_agg(jsonb_build_object('id',id,'email',email,'name',full_name,'role',role))
 FROM public.user_profiles WHERE lower(trim(email)) IN ('natalia@crtroofing.com','daniela@crtroofing.com')),
 'task_creator',pg_get_functiondef('public.create_private_company_task(text,text,date,text,uuid[])'::regprocedure),
 'task_constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid='public.company_tasks'::regclass),
 'task_triggers',(SELECT jsonb_agg(jsonb_build_object('trigger',tgname,'function',pg_get_functiondef(tgfoid)))
 FROM pg_trigger WHERE tgrelid='public.company_tasks'::regclass AND NOT tgisinternal),
 'receipt_constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid='public.phone_intake_events'::regclass)
) AS message_routing_preflight;
COMMIT;
