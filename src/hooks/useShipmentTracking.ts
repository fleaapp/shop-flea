import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ShipmentRow {
  id: string;
  provider_status: string | null;
  latest_event_summary: string | null;
  latest_event_at: string | null;
  first_scan_at: string | null;
  delivered_at: string | null;
  is_exception: boolean;
}

export interface TrackingEventRow {
  id: string;
  event_at: string;
  description: string;
  location: string | null;
}

/**
 * Latest carrier shipment + scan history for an order group.
 * Shared by ShippingStatusTracker and TrackingEvents so both read one cached query.
 */
export const useShipmentTracking = (orderGroupId?: string | null) =>
  useQuery({
    queryKey: ['tracking-events', orderGroupId],
    enabled: !!orderGroupId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: shipments } = await supabase
        .from('tracking_shipments')
        .select(
          'id, provider_status, latest_event_summary, latest_event_at, first_scan_at, delivered_at, is_exception',
        )
        .eq('order_group_id', orderGroupId!)
        .order('created_at', { ascending: false })
        .limit(1);
      const shipment = (shipments?.[0] ?? null) as ShipmentRow | null;
      if (!shipment) return { shipment: null, events: [] as TrackingEventRow[] };

      const { data: events } = await supabase
        .from('tracking_events')
        .select('id, event_at, description, location')
        .eq('shipment_id', shipment.id)
        .order('event_at', { ascending: false })
        .limit(30);
      return { shipment, events: (events ?? []) as TrackingEventRow[] };
    },
  });
