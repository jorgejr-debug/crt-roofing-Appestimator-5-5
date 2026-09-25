BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_customers (
  id text PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id),
  source_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  assigned_staff_id text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  billing_address text NOT NULL DEFAULT '',
  customer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id)
);

CREATE INDEX IF NOT EXISTS crm_customers_updated_idx ON public.crm_customers(updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_customers_source_lead_idx ON public.crm_customers(source_lead_id) WHERE source_lead_id IS NOT NULL;

ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_customers_select_company ON public.crm_customers;
CREATE POLICY crm_customers_select_company ON public.crm_customers
  FOR SELECT TO authenticated USING (public.can_use_crm());

DROP POLICY IF EXISTS crm_customers_insert_company ON public.crm_customers;
CREATE POLICY crm_customers_insert_company ON public.crm_customers
  FOR INSERT TO authenticated WITH CHECK (public.can_use_crm() AND created_by = auth.uid());

DROP POLICY IF EXISTS crm_customers_update_company ON public.crm_customers;
CREATE POLICY crm_customers_update_company ON public.crm_customers
  FOR UPDATE TO authenticated USING (public.can_use_crm()) WITH CHECK (public.can_use_crm());

DROP POLICY IF EXISTS crm_customers_delete_management ON public.crm_customers;
CREATE POLICY crm_customers_delete_management ON public.crm_customers
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND lower(coalesce(role, '')) IN ('admin', 'cfo')
    )
  );

CREATE TABLE IF NOT EXISTS public.crm_followups (
  id text PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id),
  related_type text NOT NULL DEFAULT 'lead' CHECK (related_type IN ('lead', 'customer')),
  related_id text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  due_date date,
  assigned_staff_id text NOT NULL DEFAULT '',
  follow_up_type text NOT NULL DEFAULT 'Call',
  status text NOT NULL DEFAULT 'Open',
  notes text NOT NULL DEFAULT '',
  followup_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id)
);

CREATE INDEX IF NOT EXISTS crm_followups_due_idx ON public.crm_followups(status, due_date);
CREATE INDEX IF NOT EXISTS crm_followups_assignee_idx ON public.crm_followups(assigned_staff_id, due_date);

ALTER TABLE public.crm_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_followups_select_company ON public.crm_followups;
CREATE POLICY crm_followups_select_company ON public.crm_followups
  FOR SELECT TO authenticated USING (public.can_use_crm());

DROP POLICY IF EXISTS crm_followups_insert_company ON public.crm_followups;
CREATE POLICY crm_followups_insert_company ON public.crm_followups
  FOR INSERT TO authenticated WITH CHECK (public.can_use_crm() AND created_by = auth.uid());

DROP POLICY IF EXISTS crm_followups_update_company ON public.crm_followups;
CREATE POLICY crm_followups_update_company ON public.crm_followups
  FOR UPDATE TO authenticated USING (public.can_use_crm()) WITH CHECK (public.can_use_crm());

DROP POLICY IF EXISTS crm_followups_delete_owner_or_management ON public.crm_followups;
CREATE POLICY crm_followups_delete_owner_or_management ON public.crm_followups
  FOR DELETE TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND lower(coalesce(role, '')) IN ('admin', 'cfo')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_followups TO authenticated;

COMMENT ON TABLE public.crm_customers IS 'Shared CRM customer records available only to employees authorized to use the CRM.';
COMMENT ON TABLE public.crm_followups IS 'Shared CRM reminders and follow-up records available only to employees authorized to use the CRM.';

COMMIT;
