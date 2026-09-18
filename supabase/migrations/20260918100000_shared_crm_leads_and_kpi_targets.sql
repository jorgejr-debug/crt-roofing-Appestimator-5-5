BEGIN;

CREATE OR REPLACE FUNCTION public.can_use_crm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles AS profile
    WHERE profile.id = auth.uid()
      AND lower(coalesce(profile.role, '')) IN ('admin', 'cfo', 'salesperson', 'estimator')
  );
$$;

REVOKE ALL ON FUNCTION public.can_use_crm() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_crm() TO authenticated;

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.user_profiles(id),
  originator_id uuid NOT NULL REFERENCES public.user_profiles(id),
  originator_name text NOT NULL DEFAULT '',
  originator_email text NOT NULL DEFAULT '',
  relationship_owner_id uuid REFERENCES public.user_profiles(id),
  assigned_staff_id text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  property_address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  zip_code text NOT NULL DEFAULT '',
  lead_source text NOT NULL DEFAULT 'Cold Calling',
  service_needed text NOT NULL DEFAULT '',
  quick_note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'New',
  qualification_status text NOT NULL DEFAULT 'captured'
    CHECK (qualification_status IN ('captured', 'qualified', 'not_qualified')),
  qualified_at timestamptz,
  qualified_by uuid REFERENCES public.user_profiles(id),
  accepted_for_inspection_at timestamptz,
  accepted_for_inspection_by uuid REFERENCES public.user_profiles(id),
  inspection_scheduled_at timestamptz,
  converted_customer_id text NOT NULL DEFAULT '',
  estimated_value numeric(14,2) NOT NULL DEFAULT 0 CHECK (estimated_value >= 0),
  lead_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id)
);

CREATE INDEX IF NOT EXISTS crm_leads_originator_created_idx ON public.crm_leads(originator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_leads_status_updated_idx ON public.crm_leads(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_leads_qualification_idx ON public.crm_leads(qualification_status, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_leads_phone_idx ON public.crm_leads(phone) WHERE phone <> '';

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_leads_select_company ON public.crm_leads;
CREATE POLICY crm_leads_select_company ON public.crm_leads
  FOR SELECT TO authenticated USING (public.can_use_crm());

DROP POLICY IF EXISTS crm_leads_insert_company ON public.crm_leads;
CREATE POLICY crm_leads_insert_company ON public.crm_leads
  FOR INSERT TO authenticated WITH CHECK (
    public.can_use_crm()
    AND created_by = auth.uid()
    AND originator_id = auth.uid()
  );

DROP POLICY IF EXISTS crm_leads_update_company ON public.crm_leads;
CREATE POLICY crm_leads_update_company ON public.crm_leads
  FOR UPDATE TO authenticated USING (public.can_use_crm()) WITH CHECK (public.can_use_crm());

DROP POLICY IF EXISTS crm_leads_delete_management ON public.crm_leads;
CREATE POLICY crm_leads_delete_management ON public.crm_leads
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles AS profile
      WHERE profile.id = auth.uid()
        AND lower(coalesce(profile.role, '')) IN ('admin', 'cfo')
    )
  );

CREATE TABLE IF NOT EXISTS public.crm_kpi_targets (
  key text PRIMARY KEY,
  numeric_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (numeric_value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id)
);

ALTER TABLE public.crm_kpi_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_kpi_targets_select_company ON public.crm_kpi_targets;
CREATE POLICY crm_kpi_targets_select_company ON public.crm_kpi_targets
  FOR SELECT TO authenticated USING (public.can_use_crm());

DROP POLICY IF EXISTS crm_kpi_targets_manage_finance ON public.crm_kpi_targets;
CREATE POLICY crm_kpi_targets_manage_finance ON public.crm_kpi_targets
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND lower(coalesce(role, '')) IN ('admin', 'cfo'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND lower(coalesce(role, '')) IN ('admin', 'cfo'))
  );

INSERT INTO public.crm_kpi_targets(key, numeric_value)
VALUES ('ivan_weekly_inspection_capacity', 0)
ON CONFLICT (key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_kpi_targets TO authenticated;

COMMENT ON TABLE public.crm_leads IS 'Shared company lead source of truth. Quick capture data is promoted into the existing detailed CRM workflow.';
COMMENT ON COLUMN public.crm_leads.originator_id IS 'Immutable attribution for the employee who brought the lead to CRT Roofing.';
COMMENT ON COLUMN public.crm_leads.relationship_owner_id IS 'Optional employee who remains the customer relationship owner without bypassing proposal or production SOP.';

COMMIT;
