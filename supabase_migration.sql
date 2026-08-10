-- Add missing columns to estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS local_estimate_id text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS final_bid numeric;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS selected_bid numeric;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS material_cost numeric;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS labor_cost numeric;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS travel_cost numeric;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS overhead_cost numeric;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS total_squares numeric;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS price_per_square numeric;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS roof_type text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS estimate_status text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS estimate_data jsonb;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create unique index on (user_key, local_estimate_id) for efficient upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_user_local_id ON estimates(user_key, local_estimate_id) WHERE local_estimate_id IS NOT NULL;

-- Add missing columns to completed_jobs table
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS local_estimate_id text;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS estimate_id text;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS estimate_code text;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS job_name text;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS job_address text;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS roof_type text;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS square_count numeric;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS final_bid numeric;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS labor_cost numeric;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS materials_cost numeric;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS profit numeric;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS daily_progress_log jsonb;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS labor_log jsonb;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS material_usage_log jsonb;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS actual_labor_hours numeric;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS actual_labor_cost numeric;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS actual_cost numeric;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS saved_at timestamptz;

-- Create unique index on completed_jobs (user_key, estimate_id) and (user_key, local_estimate_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_completed_jobs_user_estimate_id ON completed_jobs(user_key, estimate_id) WHERE estimate_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_completed_jobs_user_local_id ON completed_jobs(user_key, local_estimate_id) WHERE local_estimate_id IS NOT NULL;

-- Create completed_job_metrics table for actual vs estimated tracking
CREATE TABLE IF NOT EXISTS completed_job_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key text NOT NULL,
  estimate_id text NOT NULL,
  local_estimate_id text,
  estimate_code text,
  job_name text,
  customer_name text,
  roof_type text,
  total_squares numeric,
  estimate_final_bid numeric,
  estimate_material_cost numeric,
  estimate_labor_cost numeric,
  estimate_travel_cost numeric,
  actual_material_cost numeric,
  actual_labor_cost numeric,
  actual_labor_hours numeric,
  actual_travel_cost numeric,
  change_orders numeric DEFAULT 0,
  final_invoice_amount numeric,
  actual_profit numeric,
  actual_margin_percent numeric,
  material_variance numeric,
  labor_variance numeric,
  notes text,
  lessons_learned text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes on completed_job_metrics for efficient queries
CREATE INDEX IF NOT EXISTS idx_metrics_user_key ON completed_job_metrics(user_key);
CREATE INDEX IF NOT EXISTS idx_metrics_estimate_id ON completed_job_metrics(estimate_id);
CREATE INDEX IF NOT EXISTS idx_metrics_roof_type ON completed_job_metrics(roof_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_user_estimate ON completed_job_metrics(user_key, estimate_id);

-- Field Operations phase 1 tables
CREATE TABLE IF NOT EXISTS field_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key text NOT NULL,
  job_number text,
  job_name text,
  job_address text,
  work_date date,
  foreman text,
  weather_conditions text,
  job_start_time time,
  lunch_start_time time,
  lunch_end_time time,
  job_end_time time,
  fuel_purchased boolean DEFAULT false,
  work_completed text,
  materials_used text,
  equipment_used text,
  delays_or_problems text,
  safety_incidents boolean DEFAULT false,
  additional_notes text,
  status text DEFAULT 'draft',
  submitted_at timestamptz,
  submitted_by text,
  device_identifier text,
  photo_count numeric DEFAULT 0,
  total_regular_hours numeric DEFAULT 0,
  total_overtime_hours numeric DEFAULT 0,
  total_double_time_hours numeric DEFAULT 0,
  total_crew_hours numeric DEFAULT 0,
  vehicle_miles_driven numeric DEFAULT 0,
  total_fuel_receipts numeric DEFAULT 0,
  total_fuel_gallons numeric DEFAULT 0,
  calculated_lunch_duration_hours numeric DEFAULT 0,
  calculated_time_on_site_hours numeric DEFAULT 0,
  high_mileage_count numeric DEFAULT 0,
  correction_of_log_id uuid,
  correction_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_daily_log_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL,
  user_key text NOT NULL,
  employee_lookup_id text,
  employee_name text,
  employee_id text,
  start_time time,
  end_time time,
  lunch_duration_hours numeric DEFAULT 0,
  regular_hours numeric DEFAULT 0,
  overtime_hours numeric DEFAULT 0,
  double_time_hours numeric DEFAULT 0,
  role text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_daily_log_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL,
  user_key text NOT NULL,
  material_name text,
  quantity numeric DEFAULT 0,
  unit text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_daily_log_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL,
  user_key text NOT NULL,
  photo_category text,
  file_name text,
  storage_path text,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_daily_log_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL,
  user_key text NOT NULL,
  field_name text NOT NULL,
  original_value text,
  updated_value text,
  changed_by text,
  reason text,
  changed_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id text PRIMARY KEY,
  user_key text NOT NULL,
  employee_name text NOT NULL,
  employee_code text,
  role text,
  hourly_rate numeric DEFAULT 0,
  active boolean DEFAULT true,
  display_order numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_vehicles (
  id text PRIMARY KEY,
  user_key text NOT NULL,
  vehicle_name text NOT NULL,
  unit_number text,
  license_plate text,
  vehicle_type text,
  mpg numeric DEFAULT 0,
  active boolean DEFAULT true,
  display_order numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_log_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL,
  user_key text NOT NULL,
  vehicle_id text,
  truck_name text,
  unit_number text,
  license_plate text,
  vehicle_type text,
  starting_mileage numeric DEFAULT 0,
  ending_mileage numeric DEFAULT 0,
  miles_driven numeric DEFAULT 0,
  mileage_flag boolean DEFAULT false,
  other_description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_log_fuel_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL,
  user_key text NOT NULL,
  vehicle_row_id uuid,
  gallons_pumped numeric DEFAULT 0,
  total_receipt_amount numeric DEFAULT 0,
  price_per_gallon numeric DEFAULT 0,
  fuel_station text,
  receipt_date_time timestamptz,
  photo_url text,
  storage_path text,
  file_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_daily_logs_user_key ON field_daily_logs(user_key);
CREATE INDEX IF NOT EXISTS idx_field_daily_logs_work_date ON field_daily_logs(work_date);
CREATE INDEX IF NOT EXISTS idx_field_daily_logs_foreman ON field_daily_logs(foreman);
CREATE INDEX IF NOT EXISTS idx_field_daily_logs_status ON field_daily_logs(status);
CREATE INDEX IF NOT EXISTS idx_field_daily_logs_job_number ON field_daily_logs(job_number);
CREATE INDEX IF NOT EXISTS idx_field_daily_log_crew_log_id ON field_daily_log_crew(log_id);
CREATE INDEX IF NOT EXISTS idx_field_daily_log_materials_log_id ON field_daily_log_materials(log_id);
CREATE INDEX IF NOT EXISTS idx_field_daily_log_photos_log_id ON field_daily_log_photos(log_id);
CREATE INDEX IF NOT EXISTS idx_field_daily_log_revisions_log_id ON field_daily_log_revisions(log_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_key ON employees(user_key);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active);
CREATE INDEX IF NOT EXISTS idx_company_vehicles_user_key ON company_vehicles(user_key);
CREATE INDEX IF NOT EXISTS idx_company_vehicles_active ON company_vehicles(active);
CREATE INDEX IF NOT EXISTS idx_daily_log_vehicles_log_id ON daily_log_vehicles(log_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_vehicles_user_key ON daily_log_vehicles(user_key);
CREATE INDEX IF NOT EXISTS idx_daily_log_fuel_receipts_log_id ON daily_log_fuel_receipts(log_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_fuel_receipts_user_key ON daily_log_fuel_receipts(user_key);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_foreman boolean DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_driver boolean DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_number text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS payroll_id text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS foreman_employee_id text;
ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS job_start_time time;
ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS lunch_start_time time;
ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS lunch_end_time time;
ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS job_end_time time;
ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS fuel_purchased boolean DEFAULT false;
ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS vehicle_miles_driven numeric DEFAULT 0;
ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS total_fuel_receipts numeric DEFAULT 0;
ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS total_fuel_gallons numeric DEFAULT 0;
ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS calculated_lunch_duration_hours numeric DEFAULT 0;
ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS calculated_time_on_site_hours numeric DEFAULT 0;
ALTER TABLE field_daily_logs ADD COLUMN IF NOT EXISTS high_mileage_count numeric DEFAULT 0;

ALTER TABLE field_daily_log_crew ADD COLUMN IF NOT EXISTS employee_lookup_id text;
ALTER TABLE field_daily_log_crew ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE field_daily_log_crew ADD COLUMN IF NOT EXISTS end_time time;
ALTER TABLE field_daily_log_crew ADD COLUMN IF NOT EXISTS lunch_duration_hours numeric DEFAULT 0;

ALTER TABLE daily_log_vehicles ADD COLUMN IF NOT EXISTS driver_employee_id text;
ALTER TABLE daily_log_vehicles ADD COLUMN IF NOT EXISTS driver_employee_name text;

ALTER TABLE daily_log_fuel_receipts ADD COLUMN IF NOT EXISTS vehicle_row_id uuid;
ALTER TABLE daily_log_fuel_receipts ADD COLUMN IF NOT EXISTS receipt_date_time timestamptz;

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employees_admin_manage ON employees;
DROP POLICY IF EXISTS employees_office_view ON employees;
DROP POLICY IF EXISTS employees_foreman_view_active_field_ops ON employees;

CREATE POLICY employees_admin_manage
  ON employees
  FOR ALL
  USING (coalesce(auth.jwt() ->> 'app_role', '') = 'admin')
  WITH CHECK (coalesce(auth.jwt() ->> 'app_role', '') = 'admin');

CREATE POLICY employees_office_view
  ON employees
  FOR SELECT
  USING (coalesce(auth.jwt() ->> 'app_role', '') IN ('admin', 'office'));

CREATE POLICY employees_foreman_view_active_field_ops
  ON employees
  FOR SELECT
  USING (
    coalesce(auth.jwt() ->> 'app_role', '') = 'foreman'
    AND is_active = true
    AND department = 'Field Operations'
  );

-- Active Jobs / project tracking tables
CREATE TABLE IF NOT EXISTS active_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key text NOT NULL,
  job_number text,
  project_name text,
  customer text,
  property_owner text,
  property_manager text,
  address text,
  current_phase text,
  status text DEFAULT 'Scheduled',
  risk_level text DEFAULT 'Normal',
  risk_reason text,
  start_date date,
  expected_completion_date date,
  contract_amount numeric DEFAULT 0,
  amount_billed numeric DEFAULT 0,
  amount_collected numeric DEFAULT 0,
  remaining_contract_value numeric DEFAULT 0,
  project_contact text,
  project_manager text,
  field_supervisor text,
  foreman text,
  salesperson text,
  office_coordinator text,
  percent_complete numeric DEFAULT 0,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_job_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES active_jobs(id) ON DELETE CASCADE,
  user_key text NOT NULL,
  contact_type text,
  name text,
  company text,
  role text,
  phone text,
  email text,
  preferred_contact_method text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_job_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES active_jobs(id) ON DELETE CASCADE,
  user_key text NOT NULL,
  role text,
  name text,
  company text,
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_job_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES active_jobs(id) ON DELETE CASCADE,
  user_key text NOT NULL,
  issue_number text,
  date_time timestamptz,
  caller_name text,
  caller_company text,
  phone text,
  email text,
  category text,
  description text,
  priority text DEFAULT 'Normal',
  status text DEFAULT 'New',
  assigned_employee_id text,
  assigned_employee_name text,
  follow_up_deadline date,
  response text,
  reason text,
  created_by text,
  device_identifier text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_job_issue_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES active_job_issues(id) ON DELETE CASCADE,
  user_key text NOT NULL,
  comment_text text,
  commented_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_job_issue_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES active_job_issues(id) ON DELETE CASCADE,
  user_key text NOT NULL,
  file_name text,
  storage_path text,
  file_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_job_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES active_jobs(id) ON DELETE CASCADE,
  user_key text NOT NULL,
  title text,
  description text,
  status text DEFAULT 'Open',
  assigned_employee_name text,
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_job_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES active_jobs(id) ON DELETE CASCADE,
  user_key text NOT NULL,
  summary text,
  details text,
  changed_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_active_jobs_user_key ON active_jobs(user_key);
CREATE INDEX IF NOT EXISTS idx_active_jobs_job_number ON active_jobs(job_number);
CREATE INDEX IF NOT EXISTS idx_active_jobs_status ON active_jobs(status);
CREATE INDEX IF NOT EXISTS idx_active_jobs_risk_level ON active_jobs(risk_level);
CREATE INDEX IF NOT EXISTS idx_active_job_contacts_project_id ON active_job_contacts(project_id);
CREATE INDEX IF NOT EXISTS idx_active_job_team_members_project_id ON active_job_team_members(project_id);
CREATE INDEX IF NOT EXISTS idx_active_job_issues_project_id ON active_job_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_active_job_issues_status ON active_job_issues(status);
CREATE INDEX IF NOT EXISTS idx_active_job_issues_priority ON active_job_issues(priority);
CREATE INDEX IF NOT EXISTS idx_active_job_issue_comments_issue_id ON active_job_issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_active_job_issue_attachments_issue_id ON active_job_issue_attachments(issue_id);
CREATE INDEX IF NOT EXISTS idx_active_job_action_items_project_id ON active_job_action_items(project_id);
CREATE INDEX IF NOT EXISTS idx_active_job_activity_log_project_id ON active_job_activity_log(project_id);

ALTER TABLE active_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_job_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_job_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_job_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_job_issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_job_issue_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_job_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_job_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS active_jobs_admin_manage ON active_jobs;
DROP POLICY IF EXISTS active_jobs_office_view ON active_jobs;
DROP POLICY IF EXISTS active_jobs_foreman_view_active ON active_jobs;
CREATE POLICY active_jobs_admin_manage
  ON active_jobs
  FOR ALL
  USING (coalesce(auth.jwt() ->> 'app_role', '') = 'admin')
  WITH CHECK (coalesce(auth.jwt() ->> 'app_role', '') = 'admin');
CREATE POLICY active_jobs_office_view
  ON active_jobs
  FOR SELECT
  USING (coalesce(auth.jwt() ->> 'app_role', '') IN ('admin', 'office'));
CREATE POLICY active_jobs_foreman_view_active
  ON active_jobs
  FOR SELECT
  USING (
    coalesce(auth.jwt() ->> 'app_role', '') = 'foreman'
    AND is_active = true
  );

DROP POLICY IF EXISTS active_job_issues_admin_manage ON active_job_issues;
DROP POLICY IF EXISTS active_job_issues_office_view ON active_job_issues;
DROP POLICY IF EXISTS active_job_issues_foreman_view ON active_job_issues;
CREATE POLICY active_job_issues_admin_manage
  ON active_job_issues
  FOR ALL
  USING (coalesce(auth.jwt() ->> 'app_role', '') = 'admin')
  WITH CHECK (coalesce(auth.jwt() ->> 'app_role', '') = 'admin');
CREATE POLICY active_job_issues_office_view
  ON active_job_issues
  FOR SELECT
  USING (coalesce(auth.jwt() ->> 'app_role', '') IN ('admin', 'office'));
CREATE POLICY active_job_issues_foreman_view
  ON active_job_issues
  FOR SELECT
  USING (coalesce(auth.jwt() ->> 'app_role', '') IN ('admin', 'office', 'foreman'));

DROP POLICY IF EXISTS active_job_issue_comments_admin_manage ON active_job_issue_comments;
DROP POLICY IF EXISTS active_job_issue_comments_office_view ON active_job_issue_comments;
CREATE POLICY active_job_issue_comments_admin_manage
  ON active_job_issue_comments
  FOR ALL
  USING (coalesce(auth.jwt() ->> 'app_role', '') = 'admin')
  WITH CHECK (coalesce(auth.jwt() ->> 'app_role', '') = 'admin');
CREATE POLICY active_job_issue_comments_office_view
  ON active_job_issue_comments
  FOR SELECT
  USING (coalesce(auth.jwt() ->> 'app_role', '') IN ('admin', 'office', 'foreman'));

DROP POLICY IF EXISTS active_job_issue_attachments_admin_manage ON active_job_issue_attachments;
DROP POLICY IF EXISTS active_job_issue_attachments_office_view ON active_job_issue_attachments;
CREATE POLICY active_job_issue_attachments_admin_manage
  ON active_job_issue_attachments
  FOR ALL
  USING (coalesce(auth.jwt() ->> 'app_role', '') = 'admin')
  WITH CHECK (coalesce(auth.jwt() ->> 'app_role', '') = 'admin');
CREATE POLICY active_job_issue_attachments_office_view
  ON active_job_issue_attachments
  FOR SELECT
  USING (coalesce(auth.jwt() ->> 'app_role', '') IN ('admin', 'office', 'foreman'));

DROP POLICY IF EXISTS active_job_action_items_admin_manage ON active_job_action_items;
DROP POLICY IF EXISTS active_job_action_items_office_view ON active_job_action_items;
CREATE POLICY active_job_action_items_admin_manage
  ON active_job_action_items
  FOR ALL
  USING (coalesce(auth.jwt() ->> 'app_role', '') = 'admin')
  WITH CHECK (coalesce(auth.jwt() ->> 'app_role', '') = 'admin');
CREATE POLICY active_job_action_items_office_view
  ON active_job_action_items
  FOR SELECT
  USING (coalesce(auth.jwt() ->> 'app_role', '') IN ('admin', 'office', 'foreman'));

DROP POLICY IF EXISTS active_job_activity_log_admin_manage ON active_job_activity_log;
DROP POLICY IF EXISTS active_job_activity_log_office_view ON active_job_activity_log;
CREATE POLICY active_job_activity_log_admin_manage
  ON active_job_activity_log
  FOR ALL
  USING (coalesce(auth.jwt() ->> 'app_role', '') = 'admin')
  WITH CHECK (coalesce(auth.jwt() ->> 'app_role', '') = 'admin');
CREATE POLICY active_job_activity_log_office_view
  ON active_job_activity_log
  FOR SELECT
  USING (coalesce(auth.jwt() ->> 'app_role', '') IN ('admin', 'office', 'foreman'));

-- Rollback note:
-- These additions are append-only for forward migration. If the module is ever removed,
-- create a separate explicit rollback script rather than dropping tables here.

-- Employee auth, estimate ownership, and company-wide numbering
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text,
  role text NOT NULL DEFAULT 'salesperson',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION bootstrap_employee_role(p_email text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_email, '')) = 'natalia@crtroofing.com' THEN 'admin'
    ELSE 'salesperson'
  END;
$$;

CREATE OR REPLACE FUNCTION is_company_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profiles_self_select ON user_profiles;
DROP POLICY IF EXISTS user_profiles_self_insert ON user_profiles;
DROP POLICY IF EXISTS user_profiles_self_update ON user_profiles;
DROP POLICY IF EXISTS user_profiles_admin_manage ON user_profiles;

CREATE POLICY user_profiles_self_select
  ON user_profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR is_company_admin()
  );

CREATE POLICY user_profiles_self_insert
  ON user_profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND role = bootstrap_employee_role(email)
  );

CREATE POLICY user_profiles_self_update
  ON user_profiles
  FOR UPDATE
  USING (
    auth.uid() = id
    OR is_company_admin()
  )
  WITH CHECK (
    auth.uid() = id
    OR is_company_admin()
  );

CREATE POLICY user_profiles_admin_manage
  ON user_profiles
  FOR ALL
  USING (is_company_admin())
  WITH CHECK (is_company_admin());

CREATE OR REPLACE FUNCTION prevent_non_admin_profile_role_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() <> NEW.id THEN
      RAISE EXCEPTION 'Users can only create their own profile';
    END IF;
    IF NEW.role IS DISTINCT FROM bootstrap_employee_role(NEW.email) AND NOT is_company_admin() THEN
      RAISE EXCEPTION 'Role does not match bootstrap rule';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT is_company_admin() AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_non_admin_profile_role_changes ON user_profiles;
DROP TRIGGER IF EXISTS trg_prevent_non_admin_profile_role_insert ON user_profiles;
CREATE TRIGGER trg_prevent_non_admin_profile_role_insert
BEFORE INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_non_admin_profile_role_changes();
CREATE TRIGGER trg_prevent_non_admin_profile_role_changes
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_non_admin_profile_role_changes();

ALTER TABLE estimates ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS owner_display_name text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS owner_email text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS company_estimate_number bigint;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS saved_at timestamptz DEFAULT now();

-- Legacy rows may not have an auth owner yet; keep them readable to admins until reassigned.
UPDATE estimates
SET company_estimate_number = COALESCE(company_estimate_number, estimate_number)
WHERE company_estimate_number IS NULL;

CREATE SEQUENCE IF NOT EXISTS company_estimate_number_seq AS bigint START WITH 1 INCREMENT BY 1;
DO $$
DECLARE
  max_company_number bigint;
BEGIN
  SELECT COALESCE(MAX(company_estimate_number), 0) INTO max_company_number FROM estimates;
  PERFORM setval('company_estimate_number_seq', GREATEST(1, max_company_number), true);
END $$;

ALTER TABLE estimates
  ALTER COLUMN company_estimate_number SET DEFAULT nextval('company_estimate_number_seq');

UPDATE estimates
SET company_estimate_number = nextval('company_estimate_number_seq')
WHERE company_estimate_number IS NULL;

ALTER TABLE estimates ALTER COLUMN company_estimate_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_company_estimate_number ON estimates(company_estimate_number);
CREATE INDEX IF NOT EXISTS idx_estimates_owner_id ON estimates(owner_id);
CREATE INDEX IF NOT EXISTS idx_estimates_owner_saved_at ON estimates(owner_id, saved_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_owner_local_id ON estimates(owner_id, local_estimate_id) WHERE local_estimate_id IS NOT NULL;

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS estimates_select_own ON estimates;
DROP POLICY IF EXISTS estimates_insert_own ON estimates;
DROP POLICY IF EXISTS estimates_update_own ON estimates;
DROP POLICY IF EXISTS estimates_delete_own ON estimates;
DROP POLICY IF EXISTS estimates_admin_all ON estimates;

CREATE POLICY estimates_select_own
  ON estimates
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR is_company_admin()
  );

CREATE POLICY estimates_insert_own
  ON estimates
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    OR is_company_admin()
  );

CREATE POLICY estimates_update_own
  ON estimates
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR is_company_admin()
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR is_company_admin()
  );

CREATE POLICY estimates_delete_own
  ON estimates
  FOR DELETE
  USING (
    owner_id = auth.uid()
    OR is_company_admin()
  );

CREATE POLICY estimates_admin_all
  ON estimates
  FOR ALL
  USING (is_company_admin())
  WITH CHECK (is_company_admin());

CREATE OR REPLACE FUNCTION next_company_estimate_number()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_value bigint;
BEGIN
  next_value := nextval('company_estimate_number_seq');
  RETURN next_value;
END;
$$;

CREATE OR REPLACE FUNCTION peek_company_estimate_number()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT last_value + 1
  FROM company_estimate_number_seq;
$$;

-- Safe migration plan:
-- 1. Create auth users for all employees. Natalia@crtroofing.com is the bootstrap admin account.
-- 2. Backfill user_profiles.id/email/full_name/role using bootstrap_employee_role(email).
-- 3. Assign existing estimates.owner_id to the correct auth user id.
-- 4. For any estimate whose owner is unknown, leave owner_id null until an admin reassigns it.
-- 5. After backfill, only admin users should remain able to see unowned legacy rows.
