ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS disputed_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS orders_disputed_at_idx ON public.orders (disputed_at) WHERE disputed_at IS NOT NULL;