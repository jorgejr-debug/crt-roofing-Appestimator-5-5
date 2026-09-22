BEGIN;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('crm-lead-files','crm-lead-files',false,26214400,ARRAY['application/pdf'])
ON CONFLICT(id) DO UPDATE SET
  public=false,
  file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.crm_lead_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'work_order' CHECK (category IN ('work_order')),
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  content_type text NOT NULL DEFAULT 'application/pdf',
  file_size bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0 AND file_size <= 26214400),
  uploaded_by uuid NOT NULL REFERENCES public.user_profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_lead_documents_lead_idx ON public.crm_lead_documents(lead_id,created_at DESC);
ALTER TABLE public.crm_lead_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_lead_documents_select_company ON public.crm_lead_documents;
CREATE POLICY crm_lead_documents_select_company ON public.crm_lead_documents
  FOR SELECT TO authenticated USING (public.can_use_crm());

DROP POLICY IF EXISTS crm_lead_work_orders_upload ON storage.objects;
CREATE POLICY crm_lead_work_orders_upload ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id='crm-lead-files'
    AND public.can_use_crm()
    AND EXISTS (
      SELECT 1 FROM public.crm_leads lead
      WHERE lead.id::text=(storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS crm_lead_work_orders_read ON storage.objects;
CREATE POLICY crm_lead_work_orders_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='crm-lead-files'
    AND public.can_use_crm()
    AND EXISTS (
      SELECT 1 FROM public.crm_lead_documents document
      WHERE document.storage_path=name
    )
  );

DROP POLICY IF EXISTS crm_lead_work_orders_cleanup ON storage.objects;
CREATE POLICY crm_lead_work_orders_cleanup ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id='crm-lead-files'
    AND public.can_use_crm()
    AND owner_id=auth.uid()::text
    AND (storage.foldername(name))[1] IN (SELECT lead.id::text FROM public.crm_leads lead)
  );

CREATE OR REPLACE FUNCTION public.register_crm_lead_document(
  p_lead_id uuid,
  p_category text,
  p_file_name text,
  p_storage_path text,
  p_content_type text DEFAULT 'application/pdf',
  p_file_size bigint DEFAULT 0
)
RETURNS public.crm_lead_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE result public.crm_lead_documents;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_use_crm() THEN RAISE EXCEPTION 'CRM access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crm_leads WHERE id=p_lead_id) THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF p_category<>'work_order' THEN RAISE EXCEPTION 'Invalid lead document category'; END IF;
  IF lower(coalesce(p_content_type,''))<>'application/pdf' OR lower(right(trim(p_file_name),4))<>'.pdf' THEN
    RAISE EXCEPTION 'Work orders must be PDF files';
  END IF;
  IF p_file_size<0 OR p_file_size>26214400 THEN RAISE EXCEPTION 'Work order exceeds the 25 MB limit'; END IF;
  IF p_storage_path NOT LIKE p_lead_id::text||'/%' THEN RAISE EXCEPTION 'Document path does not match the lead'; END IF;

  INSERT INTO public.crm_lead_documents(lead_id,category,file_name,storage_path,content_type,file_size,uploaded_by)
  VALUES(p_lead_id,'work_order',trim(p_file_name),p_storage_path,'application/pdf',p_file_size,auth.uid())
  RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.register_crm_lead_document(uuid,text,text,text,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_crm_lead_document(uuid,text,text,text,text,bigint) TO authenticated;
GRANT SELECT ON public.crm_lead_documents TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_lead_documents;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END;
$$;

COMMIT;
