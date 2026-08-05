CREATE TABLE public.tracking_shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_group_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  carrier_name text,
  carrier_code text,
  tracking_number text NOT NULL,
  provider text NOT NULL DEFAULT '17track',
  provider_status text,
  latest_event_summary text,
  latest_event_at timestamp with time zone,
  first_scan_at timestamp with time zone,
  delivered_at timestamp with time zone,
  is_exception boolean NOT NULL DEFAULT false,
  not_found_notified_at timestamp with time zone,
  registered_at timestamp with time zone,
  last_synced_at timestamp with time zone,
  raw_payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (order_group_id, tracking_number)
);

CREATE INDEX idx_tracking_shipments_group ON public.tracking_shipments(order_group_id);
CREATE INDEX idx_tracking_shipments_number ON public.tracking_shipments(tracking_number);

CREATE TABLE public.tracking_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES public.tracking_shipments(id) ON DELETE CASCADE,
  event_at timestamp with time zone NOT NULL,
  status text,
  description text NOT NULL,
  location text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, event_at, description)
);

CREATE INDEX idx_tracking_events_shipment ON public.tracking_events(shipment_id, event_at DESC);

GRANT SELECT ON public.tracking_shipments TO authenticated;
GRANT ALL ON public.tracking_shipments TO service_role;
GRANT SELECT ON public.tracking_events TO authenticated;
GRANT ALL ON public.tracking_events TO service_role;

ALTER TABLE public.tracking_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer and seller can view their shipments"
ON public.tracking_shipments FOR SELECT TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Buyer and seller can view their tracking events"
ON public.tracking_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tracking_shipments s
  WHERE s.id = tracking_events.shipment_id
    AND (s.buyer_id = auth.uid() OR s.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
));

CREATE TRIGGER update_tracking_shipments_updated_at
BEFORE UPDATE ON public.tracking_shipments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();