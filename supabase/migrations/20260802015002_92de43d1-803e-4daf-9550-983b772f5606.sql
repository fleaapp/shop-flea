ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS secure_checkout_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_type text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_reference_listing_uniq
  ON public.orders (checkout_reference, listing_id)
  WHERE checkout_reference IS NOT NULL;