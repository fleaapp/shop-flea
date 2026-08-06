import { format } from 'date-fns';
import { useShipmentTracking } from '@/hooks/useShipmentTracking';

interface TrackingEventsProps {
  orderGroupId?: string | null;
}

const TrackingEvents = ({ orderGroupId }: TrackingEventsProps) => {
  const { data } = useShipmentTracking(orderGroupId);

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
