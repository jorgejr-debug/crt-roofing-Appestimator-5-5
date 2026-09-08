-- Secure, atomic task creation for every authenticated CRT Roofing employee.
-- The database determines the creator and creates all assignments together.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_private_company_task(
  p_title text,
  p_description text DEFAULT '',
  p_due_date date DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_assignee_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS public.company_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_task public.company_tasks;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = caller_id) THEN
    RAISE EXCEPTION 'A user profile is required before creating tasks';
  END IF;

  IF length(trim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'Task title is required';
  END IF;

  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid task priority';
  END IF;

  INSERT INTO public.company_tasks (
    title,
    description,
    due_date,
    priority,
    created_by
  )
  VALUES (
    trim(p_title),
    trim(COALESCE(p_description, '')),
    p_due_date,
    p_priority,
    caller_id
  )
  RETURNING * INTO new_task;

  INSERT INTO public.company_task_assignees (task_id, user_id, assigned_by)
  SELECT new_task.id, assignee_id, caller_id
  FROM (
    SELECT DISTINCT unnest(COALESCE(p_assignee_ids, '{}'::uuid[])) AS assignee_id
  ) requested
  WHERE assignee_id IS NOT NULL
  ON CONFLICT (task_id, user_id) DO NOTHING;

  RETURN new_task;
END;
$$;

REVOKE ALL ON FUNCTION public.create_private_company_task(text, text, date, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_private_company_task(text, text, date, text, uuid[]) TO authenticated;

COMMIT;
