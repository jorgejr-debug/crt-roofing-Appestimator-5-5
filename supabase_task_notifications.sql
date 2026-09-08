-- CRT Roofing task notifications
-- Run this entire file after the private task-participant migration.
BEGIN;

CREATE TABLE IF NOT EXISTS public.company_task_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.company_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed', 'skipped')),
  email_sent_at timestamptz,
  email_error text NOT NULL DEFAULT '',
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS company_task_notifications_user_created_idx
  ON public.company_task_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS company_task_notifications_email_idx
  ON public.company_task_notifications(email_status, created_at);

ALTER TABLE public.company_task_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_task_notifications_select_self ON public.company_task_notifications;
DROP POLICY IF EXISTS company_task_notifications_update_read_self ON public.company_task_notifications;

CREATE POLICY company_task_notifications_select_self
  ON public.company_task_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY company_task_notifications_update_read_self
  ON public.company_task_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_company_task_notification_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.task_id IS DISTINCT FROM OLD.task_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.email_status IS DISTINCT FROM OLD.email_status
    OR NEW.email_sent_at IS DISTINCT FROM OLD.email_sent_at
    OR NEW.email_error IS DISTINCT FROM OLD.email_error THEN
    RAISE EXCEPTION 'Users can only mark their task notifications as read';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_company_task_notification_update ON public.company_task_notifications;
CREATE TRIGGER trg_protect_company_task_notification_update
BEFORE UPDATE ON public.company_task_notifications
FOR EACH ROW
EXECUTE FUNCTION public.protect_company_task_notification_update();

CREATE OR REPLACE FUNCTION public.create_company_task_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id <> NEW.assigned_by THEN
    INSERT INTO public.company_task_notifications (task_id, user_id, assigned_by)
    VALUES (NEW.task_id, NEW.user_id, NEW.assigned_by)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Existing assignments remain visible in the dashboard but do not generate old emails.
INSERT INTO public.company_task_notifications (
  task_id,
  user_id,
  assigned_by,
  created_at,
  read_at,
  email_status
)
SELECT
  a.task_id,
  a.user_id,
  a.assigned_by,
  a.assigned_at,
  now(),
  'skipped'
FROM public.company_task_assignees a
WHERE a.user_id <> a.assigned_by
ON CONFLICT (task_id, user_id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_create_company_task_notification ON public.company_task_assignees;
CREATE TRIGGER trg_create_company_task_notification
AFTER INSERT ON public.company_task_assignees
FOR EACH ROW
EXECUTE FUNCTION public.create_company_task_notification();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'company_task_notifications'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.company_task_notifications;
  END IF;
END $$;

COMMIT;
