BEGIN;

ALTER TABLE public.invoice_requests
  ALTER COLUMN active_job_id DROP NOT NULL;

ALTER TABLE public.invoice_requests
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'job_handoff'
    CHECK (source_kind IN ('job_handoff', 'manual')),
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(line_items) = 'array');

CREATE TABLE IF NOT EXISTS public.invoice_support_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_request_id uuid NOT NULL REFERENCES public.invoice_requests(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  uploaded_by uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_support_documents_request_idx
  ON public.invoice_support_documents(invoice_request_id, created_at DESC);

ALTER TABLE public.invoice_support_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_support_documents_select_authorized
  ON public.invoice_support_documents FOR SELECT TO authenticated
  USING (public.can_manage_invoice_workflow());

CREATE POLICY invoice_support_documents_insert_authorized
  ON public.invoice_support_documents FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_invoice_workflow() AND uploaded_by = auth.uid());

CREATE POLICY invoice_support_documents_delete_authorized
  ON public.invoice_support_documents FOR DELETE TO authenticated
  USING (public.can_manage_invoice_workflow());

CREATE OR REPLACE FUNCTION public.create_manual_invoice_request(
  p_job_number text,
  p_project_name text,
  p_customer_name text,
  p_billing_contact_name text,
  p_billing_email text,
  p_billing_address text,
  p_purchase_order_number text,
  p_invoice_type text,
  p_due_date date,
  p_payment_terms text,
  p_invoice_number text,
  p_line_items jsonb,
  p_notes text
)
RETURNS public.invoice_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id uuid := gen_random_uuid();
  request public.invoice_requests%ROWTYPE;
  invoice_total numeric(14,2);
BEGIN
  IF NOT public.can_manage_invoice_workflow() THEN
    RAISE EXCEPTION 'Not authorized to create invoices';
  END IF;
  IF trim(coalesce(p_customer_name, '')) = '' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF trim(coalesce(p_billing_contact_name, '')) = '' THEN RAISE EXCEPTION 'Billing contact is required'; END IF;
  IF trim(coalesce(p_billing_email, '')) !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN
    RAISE EXCEPTION 'A valid billing email is required';
  END IF;
  IF trim(coalesce(p_billing_address, '')) = '' THEN RAISE EXCEPTION 'Billing address is required'; END IF;
  IF p_due_date IS NULL THEN RAISE EXCEPTION 'Due date is required'; END IF;
  IF jsonb_typeof(coalesce(p_line_items, '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(p_line_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  SELECT coalesce(sum(greatest(coalesce(item.quantity, 0), 0) * greatest(coalesce(item.unit_price, 0), 0)), 0)
  INTO invoice_total
  FROM jsonb_to_recordset(p_line_items) AS item(description text, quantity numeric, unit_price numeric);
  IF invoice_total <= 0 THEN RAISE EXCEPTION 'Invoice total must be greater than zero'; END IF;

  INSERT INTO public.invoice_requests (
    id, active_job_id, source_record_uid, source_kind, job_number, project_name,
    customer_name, billing_contact_name, billing_email, billing_address,
    purchase_order_number, invoice_type, completion_date, payment_terms,
    amount_to_invoice, notes, status, invoice_number, due_date, line_items,
    submitted_by, assigned_to
  ) VALUES (
    request_id, NULL, 'manual-invoice-' || request_id::text, 'manual',
    trim(coalesce(p_job_number, '')), trim(coalesce(p_project_name, '')),
    trim(p_customer_name), trim(p_billing_contact_name), lower(trim(p_billing_email)),
    trim(p_billing_address), trim(coalesce(p_purchase_order_number, '')),
    CASE WHEN p_invoice_type = 'Progress' THEN 'Progress' ELSE 'Final' END,
    current_date, coalesce(nullif(trim(p_payment_terms), ''), 'Due on receipt'),
    invoice_total, trim(coalesce(p_notes, '')), 'In Review',
    trim(coalesce(p_invoice_number, '')), p_due_date, p_line_items,
    auth.uid(), auth.uid()
  ) RETURNING * INTO request;

  INSERT INTO public.invoice_request_audit_log(invoice_request_id, actor_id, action, notes, details)
  VALUES (request.id, auth.uid(), 'manual_invoice_created', request.notes,
    jsonb_build_object('invoice_number', request.invoice_number, 'amount_to_invoice', request.amount_to_invoice));

  RETURN request;
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_invoice_request(text,text,text,text,text,text,text,text,date,text,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_invoice_request(text,text,text,text,text,text,text,text,date,text,text,jsonb,text) TO authenticated;

DROP FUNCTION IF EXISTS public.update_invoice_request(uuid,text,text,date,text,numeric,text,text,text,text);

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
  p_invoice_storage_path text,
  p_line_items jsonb
)
RETURNS public.invoice_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request public.invoice_requests%ROWTYPE;
  line_total numeric(14,2) := 0;
BEGIN
  IF NOT public.can_manage_invoice_workflow() THEN RAISE EXCEPTION 'Not authorized to manage invoice requests'; END IF;
  IF p_status NOT IN ('Ready for Invoice','In Review','Missing Information','Ready to Send','Send Failed','Void') THEN
    RAISE EXCEPTION 'Invalid invoice status update';
  END IF;
  IF jsonb_typeof(coalesce(p_line_items, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Line items must be a list'; END IF;

  SELECT coalesce(sum(greatest(coalesce(item.quantity, 0), 0) * greatest(coalesce(item.unit_price, 0), 0)), 0)
  INTO line_total
  FROM jsonb_to_recordset(coalesce(p_line_items, '[]'::jsonb)) AS item(description text, quantity numeric, unit_price numeric);

  IF greatest(line_total, coalesce(p_amount_to_invoice, 0)) <= 0 THEN RAISE EXCEPTION 'Amount to invoice must be greater than zero'; END IF;
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
      amount_to_invoice = CASE WHEN line_total > 0 THEN line_total ELSE p_amount_to_invoice END,
      missing_information_notes = trim(coalesce(p_missing_information_notes, '')),
      notes = trim(coalesce(p_notes, '')),
      invoice_file_name = trim(coalesce(p_invoice_file_name, '')),
      invoice_storage_path = trim(coalesce(p_invoice_storage_path, '')),
      line_items = coalesce(p_line_items, '[]'::jsonb),
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO request;
  IF request.id IS NULL THEN RAISE EXCEPTION 'Invoice request not found'; END IF;

  INSERT INTO public.invoice_request_audit_log(invoice_request_id, actor_id, action, notes, details)
  VALUES (request.id, auth.uid(), 'invoice_request_updated', request.missing_information_notes,
    jsonb_build_object('status', request.status, 'invoice_number', request.invoice_number,
      'amount_to_invoice', request.amount_to_invoice, 'line_item_count', jsonb_array_length(request.line_items)));
  RETURN request;
END;
$$;

REVOKE ALL ON FUNCTION public.update_invoice_request(uuid,text,text,date,text,numeric,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_invoice_request(uuid,text,text,date,text,numeric,text,text,text,text,jsonb) TO authenticated;

COMMIT;
