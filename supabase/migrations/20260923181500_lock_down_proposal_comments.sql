BEGIN;

REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
ON TABLE public.proposal_request_comments
FROM authenticated;

GRANT SELECT ON TABLE public.proposal_request_comments TO authenticated;

COMMIT;
