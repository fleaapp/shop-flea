ALTER TABLE public.listings DROP CONSTRAINT listings_status_check;
ALTER TABLE public.listings DROP CONSTRAINT listings_status_valid;
ALTER TABLE public.listings ADD CONSTRAINT listings_status_valid CHECK (status = ANY (ARRAY['active'::text, 'sold'::text, 'archived'::text, 'draft'::text, 'removed'::text]));