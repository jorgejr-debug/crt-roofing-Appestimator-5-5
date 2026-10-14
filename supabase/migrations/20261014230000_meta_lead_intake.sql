BEGIN;
CREATE TABLE public.meta_lead_receipts (
  meta_lead_id text PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id),
  metadata jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);
ALTER TABLE public.meta_lead_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_lead_receipts FROM anon, authenticated;
GRANT ALL ON public.meta_lead_receipts TO service_role;

CREATE FUNCTION public.ingest_meta_lead(p_meta_id text, p_owner uuid, p_fields jsonb, p_metadata jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result_id uuid; owner_profile public.user_profiles%ROWTYPE;
BEGIN
  -- Serialize retries of the same external event; never overwrite a reviewed lead.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_meta_id, 0));
  SELECT lead_id INTO result_id FROM public.meta_lead_receipts WHERE meta_lead_id = p_meta_id;
  IF result_id IS NOT NULL THEN RETURN result_id; END IF;
  SELECT * INTO owner_profile FROM public.user_profiles WHERE id = p_owner AND lower(role) IN ('admin', 'cfo');
  IF NOT FOUND THEN RAISE EXCEPTION 'Meta intake owner must be an existing admin or CFO'; END IF;
  INSERT INTO public.crm_leads (
    created_by, originator_id, originator_name, originator_email, relationship_owner_id,
    assigned_staff_id, contact_name, phone, email, lead_source, service_needed, quick_note, lead_payload
  ) VALUES (
    p_owner, p_owner, owner_profile.full_name, owner_profile.email, p_owner,
    p_owner::text, coalesce(p_fields->>'contact_name',''), coalesce(p_fields->>'phone',''),
    coalesce(p_fields->>'email',''), 'Meta Ads', 'Roof inspection', coalesce(p_fields->>'quick_note',''),
    coalesce(p_fields->'lead_payload','{}'::jsonb)
  ) RETURNING id INTO result_id;
  INSERT INTO public.meta_lead_receipts(meta_lead_id, lead_id, metadata) VALUES(p_meta_id, result_id, p_metadata);
  RETURN result_id;
END; $$;
REVOKE ALL ON FUNCTION public.ingest_meta_lead(text, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_meta_lead(text, uuid, jsonb, jsonb) TO service_role;
COMMIT;
