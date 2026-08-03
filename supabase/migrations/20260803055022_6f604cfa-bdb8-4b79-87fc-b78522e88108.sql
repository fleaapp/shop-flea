CREATE UNIQUE INDEX IF NOT EXISTS orders_one_order_per_listing_idx ON public.orders (listing_id);
DROP FUNCTION IF EXISTS public.claim_checkout_listings(uuid[]);