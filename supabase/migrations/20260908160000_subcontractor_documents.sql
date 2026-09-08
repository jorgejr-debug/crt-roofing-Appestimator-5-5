BEGIN;

CREATE TABLE IF NOT EXISTS public.subcontractor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'coi' CHECK (category IN ('coi','license','workers_comp','other')),
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0 AND file_size <= 15728640),
  uploaded_by uuid NOT NULL REFERENCES public.user_profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subcontractor_documents_subcontractor_idx ON public.subcontractor_documents(subcontractor_id, created_at DESC);
ALTER TABLE public.subcontractor_documents ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subcontractor_documents' AND policyname='subcontractor_documents_manage'
  ) THEN
    CREATE POLICY subcontractor_documents_manage ON public.subcontractor_documents FOR ALL TO authenticated
      USING (public.can_manage_subcontractor_compliance())
      WITH CHECK (public.can_manage_subcontractor_compliance());
  END IF;
END;
$$;

COMMIT;
