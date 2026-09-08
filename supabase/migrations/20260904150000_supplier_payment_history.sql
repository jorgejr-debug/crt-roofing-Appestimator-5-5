-- Apply full or partial supplier payments and preserve every payment in history.
BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_record_id uuid REFERENCES public.company_financial_records(id) ON DELETE SET NULL,
  source_record_uid text NOT NULL,
  supplier_name text NOT NULL,
  payment_date date NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('Check', 'ACH', 'Credit Card', 'Cash', 'Wire', 'Other')),
  check_number text NOT NULL DEFAULT '',
  payment_kind text NOT NULL CHECK (payment_kind IN ('Full', 'Partial')),
  amount_paid numeric NOT NULL CHECK (amount_paid > 0),
  balance_before numeric NOT NULL CHECK (balance_before >= 0),
  balance_after numeric NOT NULL CHECK (balance_after >= 0),
  note text NOT NULL DEFAULT '',
  recorded_by uuid NOT NULL REFERENCES public.user_profiles(id),
  recorded_by_name text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS supplier_payment_history_recorded_at_idx
  ON public.supplier_payment_history (recorded_at DESC);
CREATE INDEX IF NOT EXISTS supplier_payment_history_source_uid_idx
  ON public.supplier_payment_history (source_record_uid, recorded_at DESC);

ALTER TABLE public.supplier_payment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_payment_history_select_finance ON public.supplier_payment_history;
CREATE POLICY supplier_payment_history_select_finance
  ON public.supplier_payment_history
  FOR SELECT TO authenticated
  USING (public.is_finance_user());

REVOKE ALL ON TABLE public.supplier_payment_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.supplier_payment_history TO authenticated;

CREATE OR REPLACE FUNCTION public.record_supplier_payment(
  p_source_record_uid text,
  p_payment_date date,
  p_payment_method text,
  p_payment_kind text,
  p_amount_paid numeric DEFAULT NULL,
  p_check_number text DEFAULT '',
  p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  caller_name text;
  payable public.company_financial_records;
  payment public.supplier_payment_history;
  safe_source_uid text := trim(coalesce(p_source_record_uid, ''));
  safe_method text := trim(coalesce(p_payment_method, ''));
  safe_kind text := initcap(trim(coalesce(p_payment_kind, '')));
  safe_check_number text := trim(coalesce(p_check_number, ''));
  balance_before numeric;
  applied_amount numeric;
  balance_after numeric;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT lower(coalesce(profile.role, '')),
         coalesce(nullif(trim(profile.full_name), ''), nullif(trim(profile.email), ''), 'Finance user')
    INTO caller_role, caller_name
  FROM public.user_profiles AS profile
  WHERE profile.id = caller_id;

  IF caller_role NOT IN ('admin', 'cfo') THEN
    RAISE EXCEPTION 'Only CFO and admin users can record supplier payments';
  END IF;

  IF p_payment_date IS NULL OR p_payment_date > current_date THEN
    RAISE EXCEPTION 'Enter a valid payment date that is not in the future';
  END IF;
  IF safe_method NOT IN ('Check', 'ACH', 'Credit Card', 'Cash', 'Wire', 'Other') THEN
    RAISE EXCEPTION 'Select a valid payment method';
  END IF;
  IF safe_method = 'Check' AND safe_check_number = '' THEN
    RAISE EXCEPTION 'A check number is required for check payments';
  END IF;
  IF safe_kind NOT IN ('Full', 'Partial') THEN
    RAISE EXCEPTION 'Select full or partial payment';
  END IF;

  SELECT financial.*
    INTO payable
  FROM public.company_financial_records AS financial
  WHERE financial.source_record_uid = safe_source_uid
    AND financial.record_type = 'manual'
    AND financial.card_key IN ('supplierTotalsPayable', 'supplierOverdue')
    AND financial.is_archived = false
    AND lower(coalesce(financial.status, '')) <> 'paid'
  FOR UPDATE;

  IF payable.id IS NULL THEN
    RAISE EXCEPTION 'An active supplier payable was not found';
  END IF;

  balance_before := greatest(0, coalesce(payable.amount, 0));
  applied_amount := CASE WHEN safe_kind = 'Full' THEN balance_before ELSE coalesce(p_amount_paid, 0) END;

  IF applied_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;
  IF applied_amount > balance_before THEN
    RAISE EXCEPTION 'Payment amount cannot exceed the outstanding balance';
  END IF;
  IF safe_kind = 'Partial' AND applied_amount >= balance_before THEN
    RAISE EXCEPTION 'Choose Full payment when paying the entire outstanding balance';
  END IF;

  balance_after := balance_before - applied_amount;

  INSERT INTO public.supplier_payment_history (
    financial_record_id, source_record_uid, supplier_name, payment_date,
    payment_method, check_number, payment_kind, amount_paid,
    balance_before, balance_after, note, recorded_by, recorded_by_name
  ) VALUES (
    payable.id, safe_source_uid,
    coalesce(nullif(trim(payable.record_name), ''), 'Supplier invoice'),
    p_payment_date, safe_method,
    CASE WHEN safe_method = 'Check' THEN safe_check_number ELSE '' END,
    safe_kind, applied_amount, balance_before, balance_after,
    trim(coalesce(p_note, '')), caller_id, caller_name
  )
  RETURNING * INTO payment;

  UPDATE public.company_financial_records
  SET amount = balance_after,
      status = CASE WHEN balance_after = 0 THEN 'Paid' ELSE status END,
      updated_by = caller_id,
      updated_at = clock_timestamp()
  WHERE id = payable.id
  RETURNING * INTO payable;

  RETURN jsonb_build_object('payable', to_jsonb(payable), 'payment', to_jsonb(payment));
END;
$$;

REVOKE ALL ON FUNCTION public.record_supplier_payment(text, date, text, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment(text, date, text, text, numeric, text, text) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_payment_history;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END;
$$;

COMMIT;
