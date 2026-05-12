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
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS saved_at timestamptz;

-- Create unique index on completed_jobs (user_key, local_estimate_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_completed_jobs_user_local_id ON completed_jobs(user_key, local_estimate_id) WHERE local_estimate_id IS NOT NULL;
