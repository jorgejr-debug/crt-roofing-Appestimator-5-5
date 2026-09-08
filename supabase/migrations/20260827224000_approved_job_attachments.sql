BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'approved-job-attachments',
  'approved-job-attachments',
  false,
  15728640,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS approved_job_attachments_editor_read ON storage.objects;
DROP POLICY IF EXISTS approved_job_attachments_editor_insert ON storage.objects;
DROP POLICY IF EXISTS approved_job_attachments_editor_update ON storage.objects;
DROP POLICY IF EXISTS approved_job_attachments_editor_delete ON storage.objects;

CREATE POLICY approved_job_attachments_editor_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'approved-job-attachments'
    AND public.is_shared_job_editor()
  );

CREATE POLICY approved_job_attachments_editor_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'approved-job-attachments'
    AND public.is_shared_job_editor()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY approved_job_attachments_editor_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'approved-job-attachments'
    AND public.is_shared_job_editor()
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'approved-job-attachments'
    AND public.is_shared_job_editor()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY approved_job_attachments_editor_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'approved-job-attachments'
    AND public.is_shared_job_editor()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
