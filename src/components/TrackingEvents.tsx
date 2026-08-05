import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface TrackingEventsProps {
  orderGroupId?: string | null;
}

interface ShipmentRow {
  id: string;
  provider_status: string | null;
  latest_event_summary: string | null;
  latest_event_at: string | null;
  is_exception: boolean;
}

interface EventRow {
  id: string;
  event_at: string;
  description: string;
  location: string | null;
}

const TrackingEvents = ({ orderGroupId }: TrackingEventsProps) => {
  const { data } = useQuery({
    queryKey: ['tracking-events', orderGroupId],
    enabled: !!orderGroupId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: shipments } = await supabase
        .from('tracking_shipments')
        .select('id, provider_status, latest_event_summary, latest_event_at, is_exception')
        .eq('order_group_id', orderGroupId!)
        .order('created_at', { ascending: false })
        .limit(1);
      const shipment = (shipments?.[0] ?? null) as ShipmentRow | null;
      if (!shipment) return { shipment: null, events: [] as EventRow[] };

      const { data: events } = await supabase
        .from('tracking_events')
        .select('id, event_at, description, location')
        .eq('shipment_id', shipment.id)
        .order('event_at', { ascending: false })
        .limit(30);
      return { shipment, events: (events ?? []) as EventRow[] };
    },
  });

  const shipment = data?.shipment;
  const events = data?.events ?? [];
  if (!shipment || (!shipment.latest_event_summary && events.length === 0)) return null;

  return (
    <div className="rounded-xl bg-card overflow-hidden">
      <div className="bg-muted-foreground/20 px-4 py-2 text-sm font-medium text-muted-foreground">
        Carrier Updates
      </div>
      <div className="p-4 space-y-3">
        {shipment.latest_event_summary && (
          <p className="text-sm font-semibold text-foreground leading-snug">
            {shipment.latest_event_summary}
            {shipment.latest_event_at && (
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                {format(new Date(shipment.latest_event_at), "MMM d, h:mmaaa")}
              </span>
            )}
          </p>
        )}

        {events.length > 0 && (
          <details className="group">
            <summary className="text-sm font-medium text-foreground cursor-pointer list-none">
              <span className="group-open:hidden">Show full history</span>
              <span className="hidden group-open:inline">Hide history</span>
            </summary>
            <ul className="mt-3 space-y-3">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="text-sm text-foreground leading-snug">{e.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(e.event_at), "MMM d, h:mmaaa")}
                      {e.location ? ` - ${e.location}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
};

export default TrackingEvents;
