BEGIN;

-- Bind uploads to the same creator/assignee access used by private tasks.
INSERT INTO storage.buckets(id,name,public,file_size_limit)
VALUES('task-attachments','task-attachments',false,26214400)
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=26214400;

CREATE TABLE public.company_task_attachments (
  id uuid PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.company_tasks(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.user_profiles(id),
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),
  file_size bigint NOT NULL CHECK(file_size BETWEEN 0 AND 26214400),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_task_attachments_task_idx ON public.company_task_attachments(task_id,created_at);
ALTER TABLE public.company_task_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_task_attachments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.company_task_attachments TO authenticated;
GRANT ALL ON public.company_task_attachments TO service_role;
CREATE POLICY task_attachments_read ON public.company_task_attachments FOR SELECT TO authenticated
USING(public.can_access_company_task(task_id));

CREATE POLICY task_files_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='task-attachments'
  AND (storage.foldername(name))[2]=auth.uid()::text
  AND EXISTS(SELECT 1 FROM public.company_tasks t WHERE t.id::text=(storage.foldername(name))[1] AND public.can_access_company_task(t.id))
);
CREATE POLICY task_files_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='task-attachments'
  AND EXISTS(SELECT 1 FROM public.company_task_attachments a WHERE a.storage_path=name AND public.can_access_company_task(a.task_id))
);
CREATE FUNCTION public.register_task_attachment(p_task_id uuid,p_id uuid,p_storage_path text,p_file_name text,p_file_size bigint)
RETURNS public.company_task_attachments
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE saved public.company_task_attachments; actual_size bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_company_task(p_task_id) THEN RAISE EXCEPTION 'Task access required' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL OR p_storage_path IS NULL OR p_file_name IS NULL OR p_file_size IS NULL
    OR length(p_file_name) NOT BETWEEN 1 AND 255 OR p_file_size NOT BETWEEN 0 AND 26214400
    OR p_file_name !~* '\.(jpg|jpeg|png|webp|heic|heif|pdf|doc|docx|xls|xlsx|csv|txt)$'
    OR p_storage_path !~ ('^'||p_task_id::text||'/'||auth.uid()::text||'/'||p_id::text||'\.(jpg|jpeg|png|webp|heic|heif|pdf|doc|docx|xls|xlsx|csv|txt)$')
    THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  SELECT * INTO saved FROM public.company_task_attachments WHERE id=p_id;
  IF FOUND THEN
    IF saved.task_id<>p_task_id OR saved.uploaded_by<>auth.uid() OR saved.storage_path<>p_storage_path OR saved.file_name<>p_file_name OR saved.file_size<>p_file_size THEN RAISE EXCEPTION 'Attachment ID already used'; END IF;
    RETURN saved;
  END IF;
  SELECT (metadata->>'size')::bigint INTO actual_size FROM storage.objects WHERE bucket_id='task-attachments' AND name=p_storage_path;
  IF actual_size IS NULL OR actual_size<>p_file_size THEN RAISE EXCEPTION 'Upload not confirmed; retry the file'; END IF;
  INSERT INTO public.company_task_attachments(id,task_id,uploaded_by,storage_path,file_name,file_size)
  VALUES(p_id,p_task_id,auth.uid(),p_storage_path,p_file_name,p_file_size) RETURNING * INTO saved;
  RETURN saved;
END;
$$;
REVOKE ALL ON FUNCTION public.register_task_attachment(uuid,uuid,text,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_task_attachment(uuid,uuid,text,text,bigint) TO authenticated;

-- A stable lead ID makes retries safe after a mobile connection drops.
CREATE TABLE public.inspection_request_tasks (
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.user_profiles(id),
  task_id uuid NOT NULL REFERENCES public.company_tasks(id) ON DELETE CASCADE,
  PRIMARY KEY(lead_id,requested_by)
);
ALTER TABLE public.inspection_request_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inspection_request_tasks FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.inspection_request_tasks TO service_role;
CREATE FUNCTION public.create_inspection_request_task(p_lead_id uuid,p_title text,p_description text,p_priority text,p_assignee_id uuid)
RETURNS public.company_tasks
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE saved public.company_tasks;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_use_crm() THEN RAISE EXCEPTION 'Inspection request access required' USING ERRCODE='42501'; END IF;
  IF p_lead_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.crm_leads WHERE id=p_lead_id) THEN RAISE EXCEPTION 'Save the customer details first'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=p_assignee_id) THEN RAISE EXCEPTION 'Assigned technician profile is missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_lead_id::text||auth.uid()::text,0));
  SELECT t.* INTO saved FROM public.inspection_request_tasks r JOIN public.company_tasks t ON t.id=r.task_id WHERE r.lead_id=p_lead_id AND r.requested_by=auth.uid();
  IF FOUND THEN RETURN saved; END IF;
  SELECT * INTO saved FROM public.create_private_company_task(p_title,p_description,NULL,p_priority,ARRAY[p_assignee_id]);
  INSERT INTO public.inspection_request_tasks(lead_id,requested_by,task_id) VALUES(p_lead_id,auth.uid(),saved.id);
  RETURN saved;
END;
$$;
REVOKE ALL ON FUNCTION public.create_inspection_request_task(uuid,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_inspection_request_task(uuid,text,text,text,uuid) TO authenticated;
COMMIT;
