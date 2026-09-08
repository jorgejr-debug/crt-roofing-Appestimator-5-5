-- One private Tasks & Messages discussion per overdue receivable.
-- Finance users can open the thread; Natalia is always assigned for follow-up.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS company_tasks_receivable_followup_unique
  ON public.company_tasks (related_type, related_id)
  WHERE related_type = 'receivable_payment_follow_up';

CREATE OR REPLACE FUNCTION public.get_or_create_receivable_payment_followup(
  p_source_record_uid text
)
RETURNS public.company_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  natalia_id uuid;
  receivable public.company_financial_records;
  followup_task public.company_tasks;
  safe_source_uid text := trim(coalesce(p_source_record_uid, ''));
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT lower(coalesce(profile.role, ''))
    INTO caller_role
  FROM public.user_profiles AS profile
  WHERE profile.id = caller_id;

  IF caller_role NOT IN ('admin', 'cfo') THEN
    RAISE EXCEPTION 'Only CFO and admin users can open payment follow-up discussions';
  END IF;

  SELECT financial.*
    INTO receivable
  FROM public.company_financial_records AS financial
  WHERE financial.source_record_uid = safe_source_uid
    AND financial.record_type = 'receivable'
    AND financial.card_key = 'waitingOnPayment'
    AND financial.is_archived = false
    AND lower(coalesce(financial.status, '')) <> 'paid'
    AND (
      lower(coalesce(financial.status, '')) = 'overdue'
      OR financial.period_to_date < current_date
    );

  IF receivable.id IS NULL THEN
    RAISE EXCEPTION 'An active past-due account was not found';
  END IF;

  SELECT profile.id
    INTO natalia_id
  FROM public.user_profiles AS profile
  WHERE lower(coalesce(profile.email, '')) = 'natalia@crtroofing.com'
  ORDER BY profile.id
  LIMIT 1;

  IF natalia_id IS NULL THEN
    RAISE EXCEPTION 'Natalia''s employee profile was not found';
  END IF;

  SELECT task.*
    INTO followup_task
  FROM public.company_tasks AS task
  WHERE task.related_type = 'receivable_payment_follow_up'
    AND task.related_id = safe_source_uid
  LIMIT 1;

  IF followup_task.id IS NULL THEN
    INSERT INTO public.company_tasks (
      title,
      description,
      priority,
      related_type,
      related_id,
      related_label,
      created_by
    )
    VALUES (
      'Payment Follow-up: ' || coalesce(nullif(trim(receivable.customer_name), ''), nullif(trim(receivable.record_name), ''), 'Past-due account'),
      concat_ws(E'\n',
        'Use this discussion for payment-status updates with Natalia.',
        'Customer: ' || coalesce(nullif(trim(receivable.customer_name), ''), nullif(trim(receivable.record_name), ''), 'Not provided'),
        'Amount owed: $' || to_char(coalesce(receivable.amount, 0), 'FM999,999,999,990.00'),
        'Due date: ' || coalesce(to_char(receivable.period_to_date, 'MM/DD/YYYY'), 'Not provided'),
        CASE WHEN nullif(trim(receivable.note), '') IS NOT NULL THEN 'Account note: ' || trim(receivable.note) END
      ),
      'high',
      'receivable_payment_follow_up',
      safe_source_uid,
      coalesce(nullif(trim(receivable.customer_name), ''), nullif(trim(receivable.record_name), ''), 'Past-due account'),
      caller_id
    )
    ON CONFLICT DO NOTHING
    RETURNING * INTO followup_task;

    IF followup_task.id IS NULL THEN
      SELECT task.*
        INTO followup_task
      FROM public.company_tasks AS task
      WHERE task.related_type = 'receivable_payment_follow_up'
        AND task.related_id = safe_source_uid
      LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.company_task_assignees (task_id, user_id, assigned_by)
  VALUES (followup_task.id, natalia_id, caller_id)
  ON CONFLICT (task_id, user_id) DO NOTHING;

  -- If another finance manager originally opened the thread, let the current
  -- finance user participate without exposing it to the rest of the company.
  IF followup_task.created_by <> caller_id THEN
    INSERT INTO public.company_task_assignees (task_id, user_id, assigned_by)
    VALUES (followup_task.id, caller_id, caller_id)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END IF;

  RETURN followup_task;
END;
$$;

ALTER FUNCTION public.get_or_create_receivable_payment_followup(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_or_create_receivable_payment_followup(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_receivable_payment_followup(text) TO authenticated;

COMMIT;
