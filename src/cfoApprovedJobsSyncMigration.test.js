import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260824214500_sync_cfo_approved_jobs.sql", import.meta.url),
  "utf8",
);

test("CFO approved jobs are mirrored by a durable database trigger", () => {
  assert.match(migration, /CREATE TRIGGER trg_sync_cfo_approved_job_record/);
  assert.match(migration, /AFTER INSERT OR UPDATE OR DELETE ON public\.company_financial_records/);
  assert.match(migration, /ON CONFLICT \(source_record_uid\) DO UPDATE/);
});

test("existing CFO approved jobs are backfilled into shared active jobs", () => {
  assert.match(migration, /Backfill all existing CFO Approved Jobs records/);
  assert.match(migration, /FROM public\.company_financial_records AS financial/);
  assert.match(migration, /financial\.card_key = 'approvedJobs'/);
  assert.match(migration, /'job:cfo-approved:' \|\| record\.entry_id/);
});

test("sync migration preserves RLS and archives removed finance records", () => {
  assert.doesNotMatch(migration, /DISABLE ROW LEVEL SECURITY/);
  assert.match(migration, /workflow_status = 'archived'/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /OWNER TO postgres/);
});
