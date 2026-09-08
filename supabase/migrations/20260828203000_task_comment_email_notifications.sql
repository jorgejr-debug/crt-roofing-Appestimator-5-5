BEGIN;

ALTER TABLE public.company_task_notifications
  ADD COLUMN IF NOT EXISTS notification_type text NOT NULL DEFAULT 'assignment',
  ADD COLUMN IF NOT EXISTS source_comment_id uuid REFERENCES public.company_task_comments(id) ON DELETE CASCADE;

ALTER TABLE public.company_task_notifications
  DROP CONSTRAINT IF EXISTS company_task_notifications_task_id_user_id_key;

ALTER TABLE public.company_task_notifications
  DROP CONSTRAINT IF EXISTS company_task_notifications_notification_type_check;

ALTER TABLE public.company_task_notifications
  ADD CONSTRAINT company_task_notifications_notification_type_check
  CHECK (notification_type IN ('assignment', 'comment'));

CREATE UNIQUE INDEX IF NOT EXISTS company_task_notifications_assignment_unique
  ON public.company_task_notifications(task_id, user_id)
  WHERE notification_type = 'assignment';

CREATE UNIQUE INDEX IF NOT EXISTS company_task_notifications_comment_unique
  ON public.company_task_notifications(source_comment_id, user_id)
  WHERE notification_type = 'comment';

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
    OR NEW.notification_type IS DISTINCT FROM OLD.notification_type
    OR NEW.source_comment_id IS DISTINCT FROM OLD.source_comment_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.email_status IS DISTINCT FROM OLD.email_status
    OR NEW.email_sent_at IS DISTINCT FROM OLD.email_sent_at
    OR NEW.email_error IS DISTINCT FROM OLD.email_error THEN
    RAISE EXCEPTION 'Users can only mark their task notifications as read';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_company_task_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id <> NEW.assigned_by THEN
    INSERT INTO public.company_task_notifications (
      task_id,
      user_id,
      assigned_by,
      notification_type
    )
    VALUES (NEW.task_id, NEW.user_id, NEW.assigned_by, 'assignment')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_company_task_comment_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.company_task_notifications (
    task_id,
    user_id,
    assigned_by,
    notification_type,
    source_comment_id
  )
  SELECT
    NEW.task_id,
    recipient.user_id,
    NEW.author_id,
    'comment',
    NEW.id
  FROM (
    SELECT task.created_by AS user_id
    FROM public.company_tasks AS task
    WHERE task.id = NEW.task_id
    UNION
    SELECT assignee.user_id
    FROM public.company_task_assignees AS assignee
    WHERE assignee.task_id = NEW.task_id
  ) AS recipient
  WHERE recipient.user_id <> NEW.author_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_company_task_comment_notifications ON public.company_task_comments;
CREATE TRIGGER trg_create_company_task_comment_notifications
AFTER INSERT ON public.company_task_comments
FOR EACH ROW
EXECUTE FUNCTION public.create_company_task_comment_notifications();

COMMIT;
