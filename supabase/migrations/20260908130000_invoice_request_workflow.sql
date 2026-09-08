BEGIN;

CREATE OR REPLACE FUNCTION public.can_manage_invoice_workflow()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles AS profile
    WHERE profile.id = auth.uid()
      AND (
        lower(coalesce(profile.role, '')) IN ('admin', 'cfo')
        OR lower(coalesce(profile.email, '')) = 'natalia@crtroofing.com'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_invoice_workflow() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_invoice_workflow() TO authenticated;

CREATE TABLE IF NOT EXISTS public.invoice_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_job_id uuid NOT NULL REFERENCES public.active_jobs(id),
  source_record_uid text NOT NULL UNIQUE,
  job_number text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  customer_name text NOT NULL,
  billing_contact_name text NOT NULL,
  billing_email text NOT NULL,
  billing_address text NOT NULL,
  purchase_order_number text NOT NULL DEFAULT '',
  invoice_type text NOT NULL DEFAULT 'Final' CHECK (invoice_type IN ('Final', 'Progress')),
  completion_date date NOT NULL,
  payment_terms text NOT NULL DEFAULT 'Due on receipt',
  contract_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (contract_amount >= 0),
  change_orders_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (change_orders_amount >= 0),
  amount_already_billed numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_already_billed >= 0),
  amount_to_invoice numeric(14,2) NOT NULL CHECK (amount_to_invoice > 0),
  retainage_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (retainage_amount >= 0),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Ready for Invoice' CHECK (status IN (
    'Ready for Invoice', 'In Review', 'Missing Information', 'Ready to Send',
    'Sending', 'Sent', 'Send Failed', 'Partially Paid', 'Paid', 'Void'
  )),
  missing_information_notes text NOT NULL DEFAULT '',
  invoice_number text NOT NULL DEFAULT '',
  invoice_file_name text NOT NULL DEFAULT '',
  invoice_storage_path text NOT NULL DEFAULT '',
  due_date date,
  submitted_by uuid NOT NULL REFERENCES public.user_profiles(id),
  assigned_to uuid REFERENCES public.user_profiles(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  sent_by uuid REFERENCES public.user_profiles(id),
  resend_email_id text NOT NULL DEFAULT '',
  send_error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_requests_status_idx ON public.invoice_requests(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS invoice_requests_assigned_idx ON public.invoice_requests(assigned_to, status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.invoice_request_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_request_id uuid NOT NULL REFERENCES public.invoice_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.user_profiles(id),
  action text NOT NULL,
  notes text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_request_audit_idx
  ON public.invoice_request_audit_log(invoice_request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.invoice_request_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_request_id uuid NOT NULL REFERENCES public.invoice_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.user_profiles(id),
  notification_type text NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed', 'skipped')),
  email_sent_at timestamptz,
  email_error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_request_notifications_user_idx
  ON public.invoice_request_notifications(user_id, created_at DESC);

ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_request_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_request_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_requests_select_authorized
  ON public.invoice_requests FOR SELECT TO authenticated
  USING (public.can_manage_invoice_workflow() OR submitted_by = auth.uid());

CREATE POLICY invoice_request_audit_select_authorized
  ON public.invoice_request_audit_log FOR SELECT TO authenticated
  USING (
    public.can_manage_invoice_workflow()
    OR EXISTS (
      SELECT 1 FROM public.invoice_requests request
      WHERE request.id = invoice_request_id AND request.submitted_by = auth.uid()
    )
  );

CREATE POLICY invoice_request_notifications_select_self
  ON public.invoice_request_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY invoice_request_notifications_mark_read
  ON public.invoice_request_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_invoice_notification_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Edge Functions use the service role to record email delivery results. Regular
  -- authenticated users remain limited to changing read_at through the policy below.
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.invoice_request_id IS DISTINCT FROM OLD.invoice_request_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
    OR NEW.notification_type IS DISTINCT FROM OLD.notification_type
    OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.email_status IS DISTINCT FROM OLD.email_status
    OR NEW.email_sent_at IS DISTINCT FROM OLD.email_sent_at
    OR NEW.email_error IS DISTINCT FROM OLD.email_error
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Users can only mark invoice notifications as read';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_invoice_notification_update ON public.invoice_request_notifications;
CREATE TRIGGER trg_protect_invoice_notification_update
BEFORE UPDATE ON public.invoice_request_notifications
FOR EACH ROW EXECUTE FUNCTION public.protect_invoice_notification_update();

CREATE OR REPLACE FUNCTION public.submit_active_job_for_invoicing(
  p_source_record_uid text,
  p_completion_date date,
  p_invoice_type text,
  p_customer_name text,
  p_billing_contact_name text,
  p_billing_email text,
  p_billing_address text,
  p_purchase_order_number text,
  p_payment_terms text,
  p_contract_amount numeric,
  p_change_orders_amount numeric,
  p_amount_already_billed numeric,
  p_amount_to_invoice numeric,
  p_retainage_amount numeric,
  p_notes text
)
RETURNS public.invoice_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor public.user_profiles%ROWTYPE;
  job public.active_jobs%ROWTYPE;
  natalia_id uuid;
  request public.invoice_requests%ROWTYPE;
  now_at timestamptz := now();
BEGIN
  SELECT * INTO actor FROM public.user_profiles WHERE id = auth.uid();
  IF actor.id IS NULL OR lower(coalesce(actor.role, '')) NOT IN ('admin', 'cfo') THEN
    RAISE EXCEPTION 'Only an admin or CFO can close a job and submit it for invoicing';
  END IF;

  IF nullif(trim(coalesce(p_source_record_uid, '')), '') IS NULL THEN RAISE EXCEPTION 'Job is required'; END IF;
  IF p_completion_date IS NULL THEN RAISE EXCEPTION 'Completion date is required'; END IF;
  IF trim(coalesce(p_customer_name, '')) = '' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF trim(coalesce(p_billing_contact_name, '')) = '' THEN RAISE EXCEPTION 'Billing contact is required'; END IF;
  IF trim(coalesce(p_billing_email, '')) !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN RAISE EXCEPTION 'A valid billing email is required'; END IF;
  IF trim(coalesce(p_billing_address, '')) = '' THEN RAISE EXCEPTION 'Billing address is required'; END IF;
  IF coalesce(p_amount_to_invoice, 0) <= 0 THEN RAISE EXCEPTION 'Amount to invoice must be greater than zero'; END IF;
  IF coalesce(p_retainage_amount, 0) < 0 OR coalesce(p_retainage_amount, 0) > p_amount_to_invoice THEN
    RAISE EXCEPTION 'Retainage must be between zero and the invoice amount';
  END IF;

  SELECT * INTO job FROM public.active_jobs WHERE source_record_uid = trim(p_source_record_uid) FOR UPDATE;
  IF job.id IS NULL THEN RAISE EXCEPTION 'Active job not found'; END IF;
  IF lower(coalesce(job.workflow_status, '')) <> 'active' THEN RAISE EXCEPTION 'Only an active job can be submitted for invoicing'; END IF;
  IF EXISTS (SELECT 1 FROM public.invoice_requests existing WHERE existing.active_job_id = job.id AND existing.status <> 'Void') THEN
    RAISE EXCEPTION 'This job already has an invoice request';
  END IF;

  SELECT id INTO natalia_id FROM public.user_profiles WHERE lower(email) = 'natalia@crtroofing.com' LIMIT 1;
  IF natalia_id IS NULL THEN RAISE EXCEPTION 'Natalia user profile was not found'; END IF;

  INSERT INTO public.invoice_requests (
    active_job_id, source_record_uid, job_number, project_name, customer_name,
    billing_contact_name, billing_email, billing_address, purchase_order_number,
    invoice_type, completion_date, payment_terms, contract_amount, change_orders_amount,
    amount_already_billed, amount_to_invoice, retainage_amount, notes, submitted_by, assigned_to
  ) VALUES (
    job.id, job.source_record_uid, coalesce(job.job_number, ''), coalesce(job.project_name, job.job_name, ''), trim(p_customer_name),
    trim(p_billing_contact_name), lower(trim(p_billing_email)), trim(p_billing_address), trim(coalesce(p_purchase_order_number, '')),
    CASE WHEN p_invoice_type = 'Progress' THEN 'Progress' ELSE 'Final' END, p_completion_date,
    coalesce(nullif(trim(p_payment_terms), ''), 'Due on receipt'), greatest(coalesce(p_contract_amount, 0), 0),
    greatest(coalesce(p_change_orders_amount, 0), 0), greatest(coalesce(p_amount_already_billed, 0), 0),
    p_amount_to_invoice, coalesce(p_retainage_amount, 0), trim(coalesce(p_notes, '')), actor.id, natalia_id
  ) RETURNING * INTO request;

  UPDATE public.active_jobs
  SET workflow_status = 'completed',
      status = 'Work Complete - Ready for Invoice',
      is_active = false,
      updated_by = actor.id::text,
      updated_at = now_at,
      saved_at = now_at,
      job_payload = coalesce(job_payload, '{}'::jsonb) || jsonb_build_object(
        'workflowStatus', 'completed',
        'status', 'Work Complete - Ready for Invoice',
        'projectStatus', 'Work Complete - Ready for Invoice',
        'isActive', false,
        'completedAt', now_at,
        'completedBy', coalesce(actor.full_name, actor.email),
        'invoiceRequestId', request.id,
        'invoiceStatus', request.status
      )
  WHERE id = job.id;

  INSERT INTO public.invoice_request_audit_log(invoice_request_id, actor_id, action, notes, details)
  VALUES (request.id, actor.id, 'submitted_for_invoicing', trim(coalesce(p_notes, '')), jsonb_build_object(
    'amount_to_invoice', request.amount_to_invoice,
    'billing_email', request.billing_email,
    'completion_date', request.completion_date
  ));

  INSERT INTO public.invoice_request_notifications(invoice_request_id, user_id, actor_id, notification_type, message)
  VALUES (request.id, natalia_id, actor.id, 'ready_for_invoice',
    coalesce(nullif(request.project_name, ''), nullif(request.job_number, ''), request.customer_name) ||
    ' is complete and ready for invoicing. Amount requested: $' || to_char(request.amount_to_invoice, 'FM999,999,990.00'));

  RETURN request;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_active_job_for_invoicing(text,date,text,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_active_job_for_invoicing(text,date,text,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_invoice_request(
  p_request_id uuid,
  p_status text,
  p_invoice_number text,
  p_due_date date,
  p_payment_terms text,
  p_amount_to_invoice numeric,
  p_missing_information_notes text,
  p_notes text,
  p_invoice_file_name text,
  p_invoice_storage_path text
)
RETURNS public.invoice_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request public.invoice_requests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_invoice_workflow() THEN RAISE EXCEPTION 'Not authorized to manage invoice requests'; END IF;
  IF p_status NOT IN ('Ready for Invoice','In Review','Missing Information','Ready to Send','Send Failed','Void') THEN
    RAISE EXCEPTION 'Invalid invoice status update';
  END IF;
  IF coalesce(p_amount_to_invoice, 0) <= 0 THEN RAISE EXCEPTION 'Amount to invoice must be greater than zero'; END IF;
  IF p_status = 'Missing Information' AND trim(coalesce(p_missing_information_notes, '')) = '' THEN
    RAISE EXCEPTION 'Missing information notes are required';
  END IF;
  IF p_status = 'Ready to Send' AND (
    trim(coalesce(p_invoice_number, '')) = '' OR p_due_date IS NULL OR trim(coalesce(p_invoice_storage_path, '')) = ''
  ) THEN RAISE EXCEPTION 'Invoice number, due date, and PDF are required before sending'; END IF;

  UPDATE public.invoice_requests
  SET status = p_status,
      invoice_number = trim(coalesce(p_invoice_number, '')),
      due_date = p_due_date,
      payment_terms = coalesce(nullif(trim(p_payment_terms), ''), payment_terms),
      amount_to_invoice = p_amount_to_invoice,
      missing_information_notes = trim(coalesce(p_missing_information_notes, '')),
      notes = trim(coalesce(p_notes, '')),
      invoice_file_name = trim(coalesce(p_invoice_file_name, '')),
      invoice_storage_path = trim(coalesce(p_invoice_storage_path, '')),
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO request;
  IF request.id IS NULL THEN RAISE EXCEPTION 'Invoice request not found'; END IF;

  INSERT INTO public.invoice_request_audit_log(invoice_request_id, actor_id, action, notes, details)
  VALUES (request.id, auth.uid(), 'invoice_request_updated', request.missing_information_notes,
    jsonb_build_object('status', request.status, 'invoice_number', request.invoice_number, 'amount_to_invoice', request.amount_to_invoice));
  RETURN request;
END;
$$;

REVOKE ALL ON FUNCTION public.update_invoice_request(uuid,text,text,date,text,numeric,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_invoice_request(uuid,text,text,date,text,numeric,text,text,text,text) TO authenticated;

INSERT INTO storage.buckets(id, name, public)
VALUES ('invoice-documents', 'invoice-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS invoice_documents_manage ON storage.objects;
CREATE POLICY invoice_documents_manage
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'invoice-documents' AND public.can_manage_invoice_workflow())
  WITH CHECK (bucket_id = 'invoice-documents' AND public.can_manage_invoice_workflow());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_requests;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_request_notifications;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END;
$$;

COMMIT;
