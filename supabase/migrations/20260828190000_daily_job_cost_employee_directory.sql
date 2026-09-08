BEGIN;

-- Daily-cost editors need company laborer names for assignment, but not the
-- private wage, contact, payroll, or notes fields protected by employees RLS.
CREATE OR REPLACE FUNCTION public.list_daily_job_cost_employees()
RETURNS TABLE (
  id text,
  employee_name text,
  first_name text,
  last_name text,
  display_name text,
  occupation text,
  department text,
  is_active boolean,
  active boolean,
  is_foreman boolean,
  is_driver boolean,
  display_order numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_daily_job_cost_editor() THEN
    RAISE EXCEPTION 'Not authorized to view the daily job cost employee list' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    employee.id,
    employee.employee_name,
    employee.first_name,
    employee.last_name,
    employee.display_name,
    employee.occupation,
    employee.department,
    employee.is_active,
    employee.active,
    employee.is_foreman,
    employee.is_driver,
    employee.display_order
  FROM public.employees AS employee
  WHERE employee.is_active
  ORDER BY employee.display_order ASC, employee.display_name ASC, employee.first_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_daily_job_cost_employees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_daily_job_cost_employees() TO authenticated;

COMMIT;
