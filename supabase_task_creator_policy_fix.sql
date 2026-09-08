-- Allow every authenticated employee to create their own private tasks.
-- PostgreSQL records the signed-in user; the browser cannot choose another creator.
BEGIN;

ALTER TABLE public.company_tasks
  ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS company_tasks_insert_self ON public.company_tasks;

CREATE POLICY company_tasks_insert_self
  ON public.company_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

COMMIT;
