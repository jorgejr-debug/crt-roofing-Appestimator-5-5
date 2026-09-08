BEGIN;

CREATE TABLE IF NOT EXISTS public.employees (
  id text PRIMARY KEY,
  user_key text NOT NULL,
  employee_name text,
  employee_code text,
  role text,
  first_name text,
  last_name text,
  display_name text,
  occupation text,
  department text,
  is_active boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  is_foreman boolean NOT NULL DEFAULT false,
  is_driver boolean NOT NULL DEFAULT false,
  employee_number text,
  phone text,
  email text,
  hire_date date,
  hourly_rate numeric NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  payroll_id text,
  notes text,
  display_order numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_user_key ON public.employees(user_key);
CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees(is_active, department);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_admin_manage ON public.employees;
DROP POLICY IF EXISTS employees_finance_manage ON public.employees;

CREATE POLICY employees_finance_manage
  ON public.employees
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles profile
      WHERE profile.id = auth.uid()
        AND lower(coalesce(profile.role, '')) IN ('admin', 'cfo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles profile
      WHERE profile.id = auth.uid()
        AND lower(coalesce(profile.role, '')) IN ('admin', 'cfo')
    )
  );

COMMIT;
