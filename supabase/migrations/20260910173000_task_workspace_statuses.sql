BEGIN;

-- Voiding is recoverable: the task and its discussion remain stored and can be
-- viewed through task history. Past due remains derived from due_date.
ALTER TABLE public.company_tasks
  DROP CONSTRAINT IF EXISTS company_tasks_status_check;

ALTER TABLE public.company_tasks
  ADD CONSTRAINT company_tasks_status_check
  CHECK (status IN ('open', 'in_progress', 'blocked', 'completed', 'voided'));

CREATE INDEX IF NOT EXISTS company_tasks_status_due_date_idx
  ON public.company_tasks(status, due_date);

COMMENT ON COLUMN public.company_tasks.status IS
  'Task workflow status. Past due is derived from due_date for active tasks; completed and voided tasks remain available in history.';

COMMIT;
