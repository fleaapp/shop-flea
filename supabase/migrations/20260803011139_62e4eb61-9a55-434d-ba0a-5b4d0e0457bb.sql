ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_valid;
ALTER TABLE public.listings ADD CONSTRAINT listings_status_valid
  CHECK (status IN ('active','paused','archived','sold','removed','blocked','hidden','deleted','refunded'));