CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  order_id UUID,
  buyer_id UUID,
  seller_id UUID,
  amount NUMERIC,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_provider_event_id_unique UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_order_id ON public.payment_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_buyer_id ON public.payment_events(buyer_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_seller_id ON public.payment_events(seller_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_type ON public.payment_events(event_type);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment events"
ON public.payment_events
FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;