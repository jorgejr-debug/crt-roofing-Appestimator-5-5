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

-- ============================================================================
-- STAGE: Shared Admin + CFO synchronized company data (preview-only; apply manually)
-- ============================================================================

CREATE OR REPLACE FUNCTION bootstrap_employee_role(p_email text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_email, '')) = 'natalia@crtroofing.com' THEN 'admin'
    WHEN lower(coalesce(p_email, '')) = 'jorgejr@crtroofing.com' THEN 'cfo'
    ELSE 'salesperson'
  END;
$$;

CREATE OR REPLACE FUNCTION is_approved_cfo_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(p_email, '')) IN ('jorgejr@crtroofing.com');
$$;

CREATE OR REPLACE FUNCTION is_finance_user()
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
      AND (
        role = 'admin'
        OR (
          role = 'cfo'
          AND is_approved_cfo_email(email)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION bootstrap_employee_role(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION bootstrap_employee_role(text) FROM anon;
REVOKE ALL ON FUNCTION bootstrap_employee_role(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION bootstrap_employee_role(text) TO authenticated;

REVOKE ALL ON FUNCTION is_approved_cfo_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_approved_cfo_email(text) FROM anon;
REVOKE ALL ON FUNCTION is_approved_cfo_email(text) FROM authenticated;

REVOKE ALL ON FUNCTION is_finance_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_finance_user() FROM anon;
REVOKE ALL ON FUNCTION is_finance_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION is_finance_user() TO authenticated;

CREATE TABLE IF NOT EXISTS company_estimator_settings (
  id text PRIMARY KEY DEFAULT 'primary',
  material_price_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_pricing_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  travel_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_version integer NOT NULL DEFAULT 1,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_uid text NOT NULL,
  source_browser_id text,
  source_user_id uuid,
  record_type text NOT NULL,
  card_key text NOT NULL,
  record_name text,
  customer_name text,
  bank_account_name text,
  amount numeric NOT NULL DEFAULT 0,
  count_value numeric,
  period_from_date date,
  period_to_date date,
  record_date date,
  status text,
  note text,
  included_in_total boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  row_version integer NOT NULL DEFAULT 1,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_financial_records_source_record_uid_key UNIQUE (source_record_uid)
);

CREATE INDEX IF NOT EXISTS idx_company_financial_records_type_card
  ON company_financial_records(record_type, card_key);
CREATE INDEX IF NOT EXISTS idx_company_financial_records_active
  ON company_financial_records(is_archived, updated_at DESC);

CREATE OR REPLACE FUNCTION set_company_sync_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, NEW.updated_at);
    NEW.row_version := 1;
  ELSE
    NEW.created_at := COALESCE(NEW.created_at, OLD.created_at, now());
    NEW.row_version := COALESCE(OLD.row_version, 0) + 1;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_company_estimator_settings_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'company_estimator_settings is a protected singleton and cannot be deleted';
END;
$$;

REVOKE ALL ON FUNCTION set_company_sync_audit_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION set_company_sync_audit_fields() FROM anon;
REVOKE ALL ON FUNCTION set_company_sync_audit_fields() FROM authenticated;

REVOKE ALL ON FUNCTION prevent_company_estimator_settings_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION prevent_company_estimator_settings_delete() FROM anon;
REVOKE ALL ON FUNCTION prevent_company_estimator_settings_delete() FROM authenticated;

DROP TRIGGER IF EXISTS trg_company_estimator_settings_updated_at ON company_estimator_settings;
DROP TRIGGER IF EXISTS trg_company_estimator_settings_audit_fields ON company_estimator_settings;
CREATE TRIGGER trg_company_estimator_settings_audit_fields
BEFORE INSERT OR UPDATE ON company_estimator_settings
FOR EACH ROW
EXECUTE FUNCTION set_company_sync_audit_fields();

DROP TRIGGER IF EXISTS trg_company_estimator_settings_prevent_delete ON company_estimator_settings;
CREATE TRIGGER trg_company_estimator_settings_prevent_delete
BEFORE DELETE ON company_estimator_settings
FOR EACH ROW
EXECUTE FUNCTION prevent_company_estimator_settings_delete();

DROP TRIGGER IF EXISTS trg_company_financial_records_updated_at ON company_financial_records;
DROP TRIGGER IF EXISTS trg_company_financial_records_audit_fields ON company_financial_records;
CREATE TRIGGER trg_company_financial_records_audit_fields
BEFORE INSERT OR UPDATE ON company_financial_records
FOR EACH ROW
EXECUTE FUNCTION set_company_sync_audit_fields();

ALTER TABLE company_estimator_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_financial_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_estimator_settings_select_company ON company_estimator_settings;
DROP POLICY IF EXISTS company_estimator_settings_modify_finance ON company_estimator_settings;
DROP POLICY IF EXISTS company_estimator_settings_select_finance ON company_estimator_settings;
DROP POLICY IF EXISTS company_estimator_settings_insert_finance ON company_estimator_settings;
DROP POLICY IF EXISTS company_estimator_settings_update_finance ON company_estimator_settings;
CREATE POLICY company_estimator_settings_select_finance
  ON company_estimator_settings
  FOR SELECT
  USING (is_finance_user());
CREATE POLICY company_estimator_settings_insert_finance
  ON company_estimator_settings
  FOR INSERT
  WITH CHECK (
    is_finance_user()
    AND id = 'primary'
  );
CREATE POLICY company_estimator_settings_update_finance
  ON company_estimator_settings
  FOR UPDATE
  USING (is_finance_user())
  WITH CHECK (
    is_finance_user()
    AND id = 'primary'
  );

DROP POLICY IF EXISTS company_financial_records_select_finance ON company_financial_records;
DROP POLICY IF EXISTS company_financial_records_modify_finance ON company_financial_records;
DROP POLICY IF EXISTS company_financial_records_insert_finance ON company_financial_records;
DROP POLICY IF EXISTS company_financial_records_update_finance ON company_financial_records;
CREATE POLICY company_financial_records_select_finance
  ON company_financial_records
  FOR SELECT
  USING (is_finance_user());
CREATE POLICY company_financial_records_insert_finance
  ON company_financial_records
  FOR INSERT
  WITH CHECK (is_finance_user());
CREATE POLICY company_financial_records_update_finance
  ON company_financial_records
  FOR UPDATE
  USING (is_finance_user())
  WITH CHECK (is_finance_user());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'company_estimator_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE company_estimator_settings;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'company_financial_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE company_financial_records;
  END IF;
END $$;

-- ============================================================================
-- Shared job workflow (Active Jobs Preview / Approved Jobs / Upcoming Projects)
-- ============================================================================

BEGIN;

ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS source_record_uid text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS workflow_status text DEFAULT 'approved';
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS estimate_id text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS local_estimate_id text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS estimate_code text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS job_name text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS roof_type text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS job_address text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS project_contact text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS field_supervisor text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS final_bid numeric DEFAULT 0;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS square_count numeric DEFAULT 0;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS daily_progress_log jsonb DEFAULT '[]'::jsonb;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS labor_log jsonb DEFAULT '[]'::jsonb;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS material_usage_log jsonb DEFAULT '[]'::jsonb;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS actual_labor_hours numeric DEFAULT 0;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS actual_labor_cost numeric DEFAULT 0;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS actual_cost numeric DEFAULT 0;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS actual_material_cost numeric DEFAULT 0;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS documents_incomplete boolean DEFAULT false;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS subcontractor_incomplete boolean DEFAULT false;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS material_order_incomplete boolean DEFAULT false;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS customer_document_incomplete boolean DEFAULT false;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS warning_text text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS anticipated_start_date date;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS saved_at timestamptz DEFAULT now();
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE active_jobs ADD COLUMN IF NOT EXISTS job_payload jsonb DEFAULT '{}'::jsonb;

UPDATE active_jobs
SET source_record_uid = CONCAT('job:', COALESCE(NULLIF(source_record_uid, ''), NULLIF(estimate_id, ''), NULLIF(local_estimate_id, ''), NULLIF(job_number, ''), id::text))
WHERE source_record_uid IS NULL OR source_record_uid = '';

WITH duplicate_sources AS (
  SELECT
    id,
    source_record_uid,
    ROW_NUMBER() OVER (
      PARTITION BY source_record_uid
      ORDER BY COALESCE(updated_at, created_at, now()) DESC, id DESC
    ) AS duplicate_rank
  FROM active_jobs
  WHERE source_record_uid IS NOT NULL
)
UPDATE active_jobs aj
SET source_record_uid = CONCAT(aj.source_record_uid, ':dup:', aj.id::text)
FROM duplicate_sources ds
WHERE aj.id = ds.id
  AND ds.duplicate_rank > 1;

ALTER TABLE active_jobs ALTER COLUMN source_record_uid SET NOT NULL;
DROP INDEX IF EXISTS idx_active_jobs_source_record_uid;
CREATE UNIQUE INDEX idx_active_jobs_source_record_uid ON active_jobs(source_record_uid);
CREATE INDEX IF NOT EXISTS idx_active_jobs_workflow_status ON active_jobs(workflow_status);
CREATE INDEX IF NOT EXISTS idx_active_jobs_updated_at ON active_jobs(updated_at DESC);

INSERT INTO active_jobs (
  user_key,
  source_record_uid,
  workflow_status,
  estimate_id,
  local_estimate_id,
  estimate_code,
  job_number,
  job_name,
  project_name,
  customer_name,
  customer,
  address,
  job_address,
  status,
  contract_amount,
  final_bid,
  square_count,
  roof_type,
  daily_progress_log,
  labor_log,
  material_usage_log,
  actual_labor_hours,
  actual_labor_cost,
  actual_cost,
  actual_material_cost,
  anticipated_start_date,
  is_active,
  saved_at,
  updated_at,
  job_payload
)
SELECT
  coalesce(cj.user_key, 'shared') AS user_key,
  CONCAT('job:', COALESCE(NULLIF(cj.estimate_id, ''), NULLIF(cj.local_estimate_id, ''), NULLIF(cj.id::text, ''), md5(coalesce(cj.estimate_code, '') || coalesce(cj.job_name, '') || coalesce(cj.customer_name, '')))) AS source_record_uid,
  CASE
    WHEN lower(coalesce(cj.status, '')) IN ('completed', 'closed') THEN 'completed'
    WHEN lower(coalesce(cj.status, '')) IN ('scheduled', 'pre-construction', 'active', 'in progress', 'punch list', 'on hold', 'warranty') THEN 'active'
    ELSE 'approved'
  END AS workflow_status,
  cj.estimate_id,
  cj.local_estimate_id,
  cj.estimate_code,
  cj.estimate_code AS job_number,
  cj.job_name,
  cj.job_name AS project_name,
  cj.customer_name,
  cj.customer_name AS customer,
  coalesce(
    nullif(to_jsonb(cj) ->> 'job_address', ''),
    source_estimate.job_address
  ) AS address,
  coalesce(
    nullif(to_jsonb(cj) ->> 'job_address', ''),
    source_estimate.job_address
  ) AS job_address,
  cj.status,
  coalesce(
    nullif(to_jsonb(cj) ->> 'final_bid', '')::numeric,
    source_estimate.final_bid,
    0
  ) AS contract_amount,
  coalesce(
    nullif(to_jsonb(cj) ->> 'final_bid', '')::numeric,
    source_estimate.final_bid,
    0
  ) AS final_bid,
  coalesce(cj.square_count, 0) AS square_count,
  cj.roof_type,
  coalesce(cj.daily_progress_log, '[]'::jsonb),
  coalesce(cj.labor_log, '[]'::jsonb),
  coalesce(cj.material_usage_log, '[]'::jsonb),
  coalesce(cj.actual_labor_hours, 0),
  coalesce(cj.actual_labor_cost, 0),
  coalesce(nullif(to_jsonb(cj) ->> 'actual_cost', '')::numeric, 0),
  coalesce(cj.actual_material_cost, 0),
  NULL::date,
  true,
  coalesce(cj.saved_at, now()),
  coalesce(cj.saved_at, now()),
  jsonb_build_object(
    'estimateId', cj.estimate_id,
    'localEstimateId', cj.local_estimate_id,
    'estimateCode', cj.estimate_code,
    'jobName', cj.job_name,
    'projectName', cj.job_name,
    'customerName', cj.customer_name,
    'projectAddress', coalesce(
      nullif(to_jsonb(cj) ->> 'job_address', ''),
      source_estimate.job_address
    ),
    'status', cj.status,
    'projectStatus', cj.status,
    'dailyProgressLog', coalesce(cj.daily_progress_log, '[]'::jsonb)
  )
FROM completed_jobs cj
LEFT JOIN LATERAL (
  SELECT
    nullif(e.estimate_data #>> '{inputs,jobAddress}', '') AS job_address,
    coalesce(
      nullif(to_jsonb(e) ->> 'final_bid', '')::numeric,
      nullif(e.estimate_data #>> '{summary,selectedBidAmount}', '')::numeric
    ) AS final_bid
  FROM estimates e
  WHERE e.id::text IN (cj.estimate_id, cj.local_estimate_id)
     OR nullif(to_jsonb(e) ->> 'local_estimate_id', '') IN (cj.estimate_id, cj.local_estimate_id)
  ORDER BY nullif(to_jsonb(e) ->> 'saved_at', '')::timestamptz DESC NULLS LAST
  LIMIT 1
) source_estimate ON true
WHERE coalesce(cj.estimate_id, cj.local_estimate_id, '') <> ''
ON CONFLICT (source_record_uid) DO UPDATE
SET
  workflow_status = EXCLUDED.workflow_status,
  estimate_id = coalesce(EXCLUDED.estimate_id, active_jobs.estimate_id),
  local_estimate_id = coalesce(EXCLUDED.local_estimate_id, active_jobs.local_estimate_id),
  estimate_code = coalesce(EXCLUDED.estimate_code, active_jobs.estimate_code),
  job_name = coalesce(EXCLUDED.job_name, active_jobs.job_name),
  project_name = coalesce(EXCLUDED.project_name, active_jobs.project_name),
  customer_name = coalesce(EXCLUDED.customer_name, active_jobs.customer_name),
  address = coalesce(EXCLUDED.address, active_jobs.address),
  job_address = coalesce(EXCLUDED.job_address, active_jobs.job_address),
  status = coalesce(EXCLUDED.status, active_jobs.status),
  contract_amount = coalesce(EXCLUDED.contract_amount, active_jobs.contract_amount),
  final_bid = coalesce(EXCLUDED.final_bid, active_jobs.final_bid),
  square_count = coalesce(EXCLUDED.square_count, active_jobs.square_count),
  daily_progress_log = coalesce(EXCLUDED.daily_progress_log, active_jobs.daily_progress_log),
  labor_log = coalesce(EXCLUDED.labor_log, active_jobs.labor_log),
  material_usage_log = coalesce(EXCLUDED.material_usage_log, active_jobs.material_usage_log),
  actual_labor_hours = coalesce(EXCLUDED.actual_labor_hours, active_jobs.actual_labor_hours),
  actual_labor_cost = coalesce(EXCLUDED.actual_labor_cost, active_jobs.actual_labor_cost),
  actual_cost = coalesce(EXCLUDED.actual_cost, active_jobs.actual_cost),
  actual_material_cost = coalesce(EXCLUDED.actual_material_cost, active_jobs.actual_material_cost),
  saved_at = GREATEST(coalesce(active_jobs.saved_at, 'epoch'::timestamptz), coalesce(EXCLUDED.saved_at, 'epoch'::timestamptz)),
  updated_at = GREATEST(coalesce(active_jobs.updated_at, 'epoch'::timestamptz), coalesce(EXCLUDED.updated_at, 'epoch'::timestamptz)),
  job_payload = coalesce(EXCLUDED.job_payload, active_jobs.job_payload);

CREATE OR REPLACE FUNCTION is_shared_job_editor()
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
      AND role IN ('admin', 'cfo')
  );
$$;

REVOKE ALL ON FUNCTION is_shared_job_editor() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_shared_job_editor() FROM anon;
REVOKE ALL ON FUNCTION is_shared_job_editor() FROM authenticated;
GRANT EXECUTE ON FUNCTION is_shared_job_editor() TO authenticated;

ALTER TABLE active_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS active_jobs_admin_manage ON active_jobs;
DROP POLICY IF EXISTS active_jobs_office_view ON active_jobs;
DROP POLICY IF EXISTS active_jobs_foreman_view_active ON active_jobs;
DROP POLICY IF EXISTS active_jobs_select_authenticated ON active_jobs;
DROP POLICY IF EXISTS active_jobs_modify_authorized ON active_jobs;

CREATE POLICY active_jobs_select_authenticated
  ON active_jobs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY active_jobs_modify_authorized
  ON active_jobs
  FOR ALL
  USING (is_shared_job_editor())
  WITH CHECK (is_shared_job_editor());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'active_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE active_jobs;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Narrow staff access for Daniela to save one active-job progress day at a time
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_daily_job_cost_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'daniela@crtroofing.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid()
        AND lower(coalesce(role, '')) IN ('admin', 'cfo')
    );
$$;

REVOKE ALL ON FUNCTION public.is_daily_job_cost_editor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_daily_job_cost_editor() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_staff_daily_job_progress_day(
  p_source_record_uid text,
  p_day jsonb,
  p_updated_by text DEFAULT ''
)
RETURNS SETOF public.active_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  day_id text := nullif(trim(coalesce(p_day ->> 'id', '')), '');
  existing_log jsonb;
  next_log jsonb;
  saved_job public.active_jobs%ROWTYPE;
BEGIN
  IF NOT public.is_daily_job_cost_editor() THEN
    RAISE EXCEPTION 'Not authorized to update daily job costs' USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(coalesce(p_source_record_uid, '')), '') IS NULL OR day_id IS NULL THEN
    RAISE EXCEPTION 'Missing active job or daily progress identifier' USING ERRCODE = '22023';
  END IF;

  SELECT CASE
    WHEN jsonb_typeof(jobs.daily_progress_log) = 'array' THEN jobs.daily_progress_log
    ELSE '[]'::jsonb
  END
  INTO existing_log
  FROM public.active_jobs AS jobs
  WHERE jobs.source_record_uid = p_source_record_uid
    AND lower(coalesce(jobs.workflow_status, '')) = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active job not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(jsonb_agg(entry), '[]'::jsonb)
  INTO next_log
  FROM jsonb_array_elements(existing_log) AS entry
  WHERE entry ->> 'id' <> day_id;

  next_log := next_log || jsonb_build_array(p_day);

  UPDATE public.active_jobs AS jobs
  SET
    daily_progress_log = next_log,
    updated_at = clock_timestamp(),
    updated_by = nullif(trim(coalesce(p_updated_by, '')), ''),
    job_payload = coalesce(jobs.job_payload, '{}'::jsonb) || jsonb_build_object(
      'dailyProgressLog', next_log,
      'updatedAt', clock_timestamp()
    )
  WHERE jobs.source_record_uid = p_source_record_uid
  RETURNING jobs.* INTO saved_job;

  RETURN NEXT saved_job;
END;
$$;

REVOKE ALL ON FUNCTION public.save_staff_daily_job_progress_day(text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_staff_daily_job_progress_day(text, jsonb, text) TO authenticated;

COMMIT;

-- ============================================================================
-- Secure liquid-cash email-code reveal (apply manually; do not expose cash via RLS)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.liquid_cash_access_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts = 5),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'exhausted', 'superseded', 'email_failed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  verified_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_liquid_cash_challenges_user_created
  ON public.liquid_cash_access_challenges(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.liquid_cash_reveal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.liquid_cash_access_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  revealed_at timestamptz,
  hidden_at timestamptz,
  hide_reason text CHECK (hide_reason IS NULL OR hide_reason IN ('hidden', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_liquid_cash_reveal_user_expiry
  ON public.liquid_cash_reveal_sessions(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.liquid_cash_audit_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  challenge_id uuid REFERENCES public.liquid_cash_access_challenges(id) ON DELETE SET NULL,
  reveal_session_id uuid REFERENCES public.liquid_cash_reveal_sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_liquid_cash_audit_user_event
  ON public.liquid_cash_audit_events(user_id, event_at DESC);

ALTER TABLE public.liquid_cash_access_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquid_cash_reveal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquid_cash_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.liquid_cash_access_challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.liquid_cash_reveal_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.liquid_cash_audit_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_liquid_cash_access_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = p_user_id
      AND role IN ('admin', 'cfo')
  );
$$;

REVOKE ALL ON FUNCTION public.is_liquid_cash_access_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_liquid_cash_access_user(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.verify_liquid_cash_challenge(
  p_challenge_id uuid,
  p_user_id uuid,
  p_code_hash text,
  p_reveal_token_hash text
)
RETURNS TABLE (
  outcome text,
  attempts_remaining integer,
  reveal_session_id uuid,
  reveal_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  challenge_row public.liquid_cash_access_challenges%ROWTYPE;
  next_attempt_count integer;
  new_session_id uuid;
  new_expiry timestamptz;
BEGIN
  SELECT * INTO challenge_row
  FROM public.liquid_cash_access_challenges
  WHERE id = p_challenge_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, 0, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF challenge_row.status <> 'pending' THEN
    RETURN QUERY SELECT
      CASE WHEN challenge_row.status = 'verified' THEN 'already_used' ELSE challenge_row.status END,
      0,
      NULL::uuid,
      NULL::timestamptz;
    RETURN;
  END IF;

  IF clock_timestamp() >= challenge_row.expires_at THEN
    UPDATE public.liquid_cash_access_challenges SET status = 'expired' WHERE id = challenge_row.id;
    INSERT INTO public.liquid_cash_audit_events(user_id, challenge_id, event_type, metadata)
    VALUES (p_user_id, challenge_row.id, 'code_expired', jsonb_build_object('expires_at', challenge_row.expires_at));
    RETURN QUERY SELECT 'expired'::text, 0, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF challenge_row.attempt_count >= challenge_row.max_attempts THEN
    UPDATE public.liquid_cash_access_challenges SET status = 'exhausted' WHERE id = challenge_row.id;
    RETURN QUERY SELECT 'exhausted'::text, 0, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF challenge_row.code_hash <> p_code_hash THEN
    next_attempt_count := challenge_row.attempt_count + 1;
    UPDATE public.liquid_cash_access_challenges
    SET attempt_count = next_attempt_count,
        status = CASE WHEN next_attempt_count >= max_attempts THEN 'exhausted' ELSE 'pending' END
    WHERE id = challenge_row.id;
    INSERT INTO public.liquid_cash_audit_events(user_id, challenge_id, event_type, metadata)
    VALUES (
      p_user_id,
      challenge_row.id,
      CASE WHEN next_attempt_count >= challenge_row.max_attempts THEN 'attempts_exhausted' ELSE 'verification_failed' END,
      jsonb_build_object('attempt_number', next_attempt_count, 'attempts_remaining', GREATEST(0, challenge_row.max_attempts - next_attempt_count))
    );
    RETURN QUERY SELECT
      CASE WHEN next_attempt_count >= challenge_row.max_attempts THEN 'exhausted' ELSE 'failed' END,
      GREATEST(0, challenge_row.max_attempts - next_attempt_count),
      NULL::uuid,
      NULL::timestamptz;
    RETURN;
  END IF;

  UPDATE public.liquid_cash_access_challenges
  SET status = 'verified', verified_at = clock_timestamp()
  WHERE id = challenge_row.id;
  INSERT INTO public.liquid_cash_audit_events(user_id, challenge_id, event_type, metadata)
  VALUES (p_user_id, challenge_row.id, 'verification_succeeded', '{}'::jsonb);

  new_session_id := gen_random_uuid();
  new_expiry := clock_timestamp() + interval '60 seconds';
  INSERT INTO public.liquid_cash_reveal_sessions(id, challenge_id, user_id, token_hash, expires_at)
  VALUES (new_session_id, challenge_row.id, p_user_id, p_reveal_token_hash, new_expiry);
  INSERT INTO public.liquid_cash_audit_events(user_id, challenge_id, reveal_session_id, event_type, metadata)
  VALUES (p_user_id, challenge_row.id, new_session_id, 'reveal_started', jsonb_build_object('expires_at', new_expiry));

  RETURN QUERY SELECT 'success'::text, challenge_row.max_attempts - challenge_row.attempt_count, new_session_id, new_expiry;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_liquid_cash_challenge(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_liquid_cash_challenge(uuid, uuid, text, text) TO service_role;

DROP POLICY IF EXISTS company_financial_records_select_finance ON public.company_financial_records;
DROP POLICY IF EXISTS company_financial_records_insert_finance ON public.company_financial_records;
DROP POLICY IF EXISTS company_financial_records_update_finance ON public.company_financial_records;

CREATE POLICY company_financial_records_select_finance
  ON public.company_financial_records
  FOR SELECT TO authenticated
  USING (public.is_finance_user() AND record_type <> 'liquid_cash');

CREATE POLICY company_financial_records_insert_finance
  ON public.company_financial_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_user() AND record_type <> 'liquid_cash');

CREATE POLICY company_financial_records_update_finance
  ON public.company_financial_records
  FOR UPDATE TO authenticated
  USING (public.is_finance_user() AND record_type <> 'liquid_cash')
  WITH CHECK (public.is_finance_user() AND record_type <> 'liquid_cash');

COMMIT;

-- ============================================================================
-- PRIVATE TASK PARTICIPANTS (standalone forward migration)
-- Only a task creator and assigned users can read the task and its discussion.
-- ============================================================================
/* Superseded copy retained for migration history. The active privacy patch is
   located after the task and profile migrations so fresh installs run safely.
BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_company_task(task_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_tasks t
    WHERE t.id = task_uuid
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.company_task_assignees a
          WHERE a.task_id = t.id
            AND a.user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_task_creator(task_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_tasks t
    WHERE t.id = task_uuid
      AND t.created_by = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_company_task(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_task_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_company_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_task_creator(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_company_task_participant_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Task ownership fields cannot be changed';
  END IF;

  IF OLD.created_by <> auth.uid()
    AND (
      NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.related_type IS DISTINCT FROM OLD.related_type
      OR NEW.related_id IS DISTINCT FROM OLD.related_id
      OR NEW.related_label IS DISTINCT FROM OLD.related_label
    ) THEN
    RAISE EXCEPTION 'Assigned users can only update task status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_company_task_participant_update ON public.company_tasks;
CREATE TRIGGER trg_protect_company_task_participant_update
BEFORE UPDATE ON public.company_tasks
FOR EACH ROW
EXECUTE FUNCTION public.protect_company_task_participant_update();

DROP POLICY IF EXISTS company_tasks_select_company ON public.company_tasks;
DROP POLICY IF EXISTS company_tasks_select_participants ON public.company_tasks;
DROP POLICY IF EXISTS company_tasks_update_participants ON public.company_tasks;
DROP POLICY IF EXISTS company_tasks_delete_owner_admin ON public.company_tasks;
DROP POLICY IF EXISTS company_tasks_delete_creator ON public.company_tasks;

CREATE POLICY company_tasks_select_participants
  ON public.company_tasks
  FOR SELECT
  TO authenticated
  USING (public.can_access_company_task(id));

CREATE POLICY company_tasks_update_participants
  ON public.company_tasks
  FOR UPDATE
  TO authenticated
  USING (public.can_access_company_task(id))
  WITH CHECK (public.can_access_company_task(id));

CREATE POLICY company_tasks_delete_creator
  ON public.company_tasks
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS company_task_assignees_select_company ON public.company_task_assignees;
DROP POLICY IF EXISTS company_task_assignees_select_participants ON public.company_task_assignees;
DROP POLICY IF EXISTS company_task_assignees_manage_owner_admin ON public.company_task_assignees;
DROP POLICY IF EXISTS company_task_assignees_manage_creator ON public.company_task_assignees;

CREATE POLICY company_task_assignees_select_participants
  ON public.company_task_assignees
  FOR SELECT
  TO authenticated
  USING (public.can_access_company_task(task_id));

CREATE POLICY company_task_assignees_manage_creator
  ON public.company_task_assignees
  FOR ALL
  TO authenticated
  USING (public.is_company_task_creator(task_id))
  WITH CHECK (
    assigned_by = auth.uid()
    AND public.is_company_task_creator(task_id)
  );

DROP POLICY IF EXISTS company_task_comments_select_company ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_select_participants ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_insert_self ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_insert_participant ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_delete_self_admin ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_delete_self ON public.company_task_comments;

CREATE POLICY company_task_comments_select_participants
  ON public.company_task_comments
  FOR SELECT
  TO authenticated
  USING (public.can_access_company_task(task_id));

CREATE POLICY company_task_comments_insert_participant
  ON public.company_task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_access_company_task(task_id)
  );

CREATE POLICY company_task_comments_delete_self
  ON public.company_task_comments
  FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    AND public.can_access_company_task(task_id)
  );

COMMIT;

-- ============================================================================
-- TASK ASSIGNMENT NOTIFICATIONS (standalone forward migration)
-- Dashboard alerts plus server-side email delivery tracking.
-- ============================================================================
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
*/

-- ============================================================================
-- TASKS, COMPANY DIRECTORY, AND DIRECT MESSAGES (standalone forward migration)
-- Requires the base user_profiles migration. It can run before or after profile photos.
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS user_profiles_self_select ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_company_select ON public.user_profiles;
CREATE POLICY user_profiles_company_select
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.company_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'completed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_date date,
  related_type text NOT NULL DEFAULT '',
  related_id text NOT NULL DEFAULT '',
  related_label text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_tasks
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE TABLE IF NOT EXISTS public.company_task_assignees (
  task_id uuid NOT NULL REFERENCES public.company_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.company_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.company_tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  recipient_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK (sender_id <> recipient_id)
);

CREATE OR REPLACE FUNCTION public.create_private_company_task(
  p_title text,
  p_description text DEFAULT '',
  p_due_date date DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_assignee_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS public.company_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_task public.company_tasks;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = caller_id) THEN
    RAISE EXCEPTION 'A user profile is required before creating tasks';
  END IF;

  IF length(trim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'Task title is required';
  END IF;

  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid task priority';
  END IF;

  INSERT INTO public.company_tasks (title, description, due_date, priority, created_by)
  VALUES (trim(p_title), trim(COALESCE(p_description, '')), p_due_date, p_priority, caller_id)
  RETURNING * INTO new_task;

  INSERT INTO public.company_task_assignees (task_id, user_id, assigned_by)
  SELECT new_task.id, assignee_id, caller_id
  FROM (
    SELECT DISTINCT unnest(COALESCE(p_assignee_ids, '{}'::uuid[])) AS assignee_id
  ) requested
  WHERE assignee_id IS NOT NULL
  ON CONFLICT (task_id, user_id) DO NOTHING;

  RETURN new_task;
END;
$$;

REVOKE ALL ON FUNCTION public.create_private_company_task(text, text, date, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_private_company_task(text, text, date, text, uuid[]) TO authenticated;

CREATE INDEX IF NOT EXISTS company_tasks_created_by_idx ON public.company_tasks(created_by);
CREATE INDEX IF NOT EXISTS company_tasks_due_date_idx ON public.company_tasks(due_date);
CREATE INDEX IF NOT EXISTS company_task_assignees_user_idx ON public.company_task_assignees(user_id);
CREATE INDEX IF NOT EXISTS company_task_comments_task_idx ON public.company_task_comments(task_id, created_at);
CREATE INDEX IF NOT EXISTS company_messages_participants_idx ON public.company_messages(sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS company_messages_recipient_unread_idx ON public.company_messages(recipient_id, read_at);

CREATE OR REPLACE FUNCTION public.set_company_task_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_tasks_updated_at ON public.company_tasks;
CREATE TRIGGER trg_company_tasks_updated_at
BEFORE UPDATE ON public.company_tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_company_task_updated_at();

CREATE OR REPLACE FUNCTION public.protect_company_message_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
    OR NEW.body IS DISTINCT FROM OLD.body
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only the message read timestamp can be updated';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_company_message_content ON public.company_messages;
CREATE TRIGGER trg_protect_company_message_content
BEFORE UPDATE ON public.company_messages
FOR EACH ROW
EXECUTE FUNCTION public.protect_company_message_content();

ALTER TABLE public.company_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_tasks_select_company ON public.company_tasks;
DROP POLICY IF EXISTS company_tasks_insert_self ON public.company_tasks;
DROP POLICY IF EXISTS company_tasks_update_participants ON public.company_tasks;
DROP POLICY IF EXISTS company_tasks_delete_owner_admin ON public.company_tasks;
CREATE POLICY company_tasks_select_company ON public.company_tasks FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY company_tasks_insert_self ON public.company_tasks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY company_tasks_update_participants ON public.company_tasks
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_company_admin()
    OR EXISTS (
      SELECT 1 FROM public.company_task_assignees a
      WHERE a.task_id = company_tasks.id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_company_admin()
    OR EXISTS (
      SELECT 1 FROM public.company_task_assignees a
      WHERE a.task_id = company_tasks.id AND a.user_id = auth.uid()
    )
  );
CREATE POLICY company_tasks_delete_owner_admin ON public.company_tasks
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_company_admin());

DROP POLICY IF EXISTS company_task_assignees_select_company ON public.company_task_assignees;
DROP POLICY IF EXISTS company_task_assignees_manage_owner_admin ON public.company_task_assignees;
CREATE POLICY company_task_assignees_select_company ON public.company_task_assignees
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY company_task_assignees_manage_owner_admin ON public.company_task_assignees
  FOR ALL TO authenticated
  USING (
    public.is_company_admin()
    OR EXISTS (
      SELECT 1 FROM public.company_tasks t
      WHERE t.id = company_task_assignees.task_id AND t.created_by = auth.uid()
    )
  )
  WITH CHECK (
    assigned_by = auth.uid()
    AND (
      public.is_company_admin()
      OR EXISTS (
        SELECT 1 FROM public.company_tasks t
        WHERE t.id = company_task_assignees.task_id AND t.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS company_task_comments_select_company ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_insert_self ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_delete_self_admin ON public.company_task_comments;
CREATE POLICY company_task_comments_select_company ON public.company_task_comments
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY company_task_comments_insert_self ON public.company_task_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY company_task_comments_delete_self_admin ON public.company_task_comments
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_company_admin());

DROP POLICY IF EXISTS company_messages_select_participants ON public.company_messages;
DROP POLICY IF EXISTS company_messages_insert_sender ON public.company_messages;
DROP POLICY IF EXISTS company_messages_update_recipient ON public.company_messages;
CREATE POLICY company_messages_select_participants ON public.company_messages
  FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY company_messages_insert_sender ON public.company_messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND recipient_id <> auth.uid());
CREATE POLICY company_messages_update_recipient ON public.company_messages
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

DO $$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH table_name IN ARRAY ARRAY['company_tasks', 'company_task_assignees', 'company_task_comments', 'company_messages']
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- INSPECTION ONLY (deferred RLS plan for completed_jobs/completed_job_metrics/approved_jobs)
-- ============================================================================
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'
--   AND tablename IN ('completed_jobs', 'completed_job_metrics', 'approved_jobs');
-- SELECT policyname, tablename, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('completed_jobs', 'completed_job_metrics', 'approved_jobs')
-- ORDER BY tablename, policyname;

-- ============================================================================
-- ROLLBACK SKELETON (manual use only)
-- ============================================================================
-- DROP POLICY IF EXISTS company_estimator_settings_select_company ON company_estimator_settings;
-- DROP POLICY IF EXISTS company_estimator_settings_modify_finance ON company_estimator_settings;
-- DROP POLICY IF EXISTS company_estimator_settings_select_finance ON company_estimator_settings;
-- DROP POLICY IF EXISTS company_estimator_settings_insert_finance ON company_estimator_settings;
-- DROP POLICY IF EXISTS company_estimator_settings_update_finance ON company_estimator_settings;
-- DROP POLICY IF EXISTS company_financial_records_select_finance ON company_financial_records;
-- DROP POLICY IF EXISTS company_financial_records_modify_finance ON company_financial_records;
-- DROP POLICY IF EXISTS company_financial_records_insert_finance ON company_financial_records;
-- DROP POLICY IF EXISTS company_financial_records_update_finance ON company_financial_records;
-- DROP TRIGGER IF EXISTS trg_company_estimator_settings_prevent_delete ON company_estimator_settings;
-- DROP TRIGGER IF EXISTS trg_company_estimator_settings_audit_fields ON company_estimator_settings;
-- DROP TRIGGER IF EXISTS trg_company_financial_records_audit_fields ON company_financial_records;
-- DROP FUNCTION IF EXISTS prevent_company_estimator_settings_delete();
-- DROP FUNCTION IF EXISTS set_company_sync_audit_fields();
-- DROP FUNCTION IF EXISTS is_finance_user();
-- DROP FUNCTION IF EXISTS is_approved_cfo_email(text);
-- DROP TABLE IF EXISTS company_financial_records;
-- DROP TABLE IF EXISTS company_estimator_settings;

-- ============================================================================
-- PROFILE PHOTOS (standalone forward migration)
-- Run this block after the shared jobs/company sync migration above.
-- ============================================================================
BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS profile_photos_authenticated_read ON storage.objects;
DROP POLICY IF EXISTS profile_photos_self_insert ON storage.objects;
DROP POLICY IF EXISTS profile_photos_self_update ON storage.objects;
DROP POLICY IF EXISTS profile_photos_self_delete ON storage.objects;

CREATE POLICY profile_photos_authenticated_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'profile-photos');

CREATE POLICY profile_photos_self_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY profile_photos_self_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY profile_photos_self_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;

-- ============================================================================
-- PRIVATE TASK PARTICIPANTS (standalone forward migration)
-- Only a task creator and assigned users can read the task and its discussion.
-- ============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.protect_company_task_participant_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Task ownership fields cannot be changed';
  END IF;

  IF OLD.created_by <> auth.uid()
    AND (
      NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.related_type IS DISTINCT FROM OLD.related_type
      OR NEW.related_id IS DISTINCT FROM OLD.related_id
      OR NEW.related_label IS DISTINCT FROM OLD.related_label
    ) THEN
    RAISE EXCEPTION 'Assigned users can only update task status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_company_task_participant_update ON public.company_tasks;
CREATE TRIGGER trg_protect_company_task_participant_update
BEFORE UPDATE ON public.company_tasks
FOR EACH ROW
EXECUTE FUNCTION public.protect_company_task_participant_update();

-- Task assignment notifications are created in the same forward migration so
-- the dashboard badge is ready as soon as task privacy is enabled.
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

CREATE OR REPLACE FUNCTION public.can_access_company_task(task_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_tasks t
    WHERE t.id = task_uuid
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.company_task_assignees a
          WHERE a.task_id = t.id
            AND a.user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_task_creator(task_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_tasks t
    WHERE t.id = task_uuid
      AND t.created_by = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_company_task(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_task_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_company_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_task_creator(uuid) TO authenticated;

DROP POLICY IF EXISTS company_tasks_select_company ON public.company_tasks;
DROP POLICY IF EXISTS company_tasks_select_participants ON public.company_tasks;
DROP POLICY IF EXISTS company_tasks_update_participants ON public.company_tasks;
DROP POLICY IF EXISTS company_tasks_delete_owner_admin ON public.company_tasks;
DROP POLICY IF EXISTS company_tasks_delete_creator ON public.company_tasks;

CREATE POLICY company_tasks_select_participants
  ON public.company_tasks
  FOR SELECT
  TO authenticated
  USING (public.can_access_company_task(id));

CREATE POLICY company_tasks_update_participants
  ON public.company_tasks
  FOR UPDATE
  TO authenticated
  USING (public.can_access_company_task(id))
  WITH CHECK (public.can_access_company_task(id));

CREATE POLICY company_tasks_delete_creator
  ON public.company_tasks
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS company_task_assignees_select_company ON public.company_task_assignees;
DROP POLICY IF EXISTS company_task_assignees_select_participants ON public.company_task_assignees;
DROP POLICY IF EXISTS company_task_assignees_manage_owner_admin ON public.company_task_assignees;
DROP POLICY IF EXISTS company_task_assignees_manage_creator ON public.company_task_assignees;

CREATE POLICY company_task_assignees_select_participants
  ON public.company_task_assignees
  FOR SELECT
  TO authenticated
  USING (public.can_access_company_task(task_id));

CREATE POLICY company_task_assignees_manage_creator
  ON public.company_task_assignees
  FOR ALL
  TO authenticated
  USING (public.is_company_task_creator(task_id))
  WITH CHECK (
    assigned_by = auth.uid()
    AND public.is_company_task_creator(task_id)
  );

DROP POLICY IF EXISTS company_task_comments_select_company ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_select_participants ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_insert_self ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_insert_participant ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_delete_self_admin ON public.company_task_comments;
DROP POLICY IF EXISTS company_task_comments_delete_self ON public.company_task_comments;

CREATE POLICY company_task_comments_select_participants
  ON public.company_task_comments
  FOR SELECT
  TO authenticated
  USING (public.can_access_company_task(task_id));

CREATE POLICY company_task_comments_insert_participant
  ON public.company_task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_access_company_task(task_id)
  );

CREATE POLICY company_task_comments_delete_self
  ON public.company_task_comments
  FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    AND public.can_access_company_task(task_id)
  );

COMMIT;
