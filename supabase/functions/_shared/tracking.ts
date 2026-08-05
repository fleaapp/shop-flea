// Shared 17track adapter. Keeping every provider-specific detail in this file
// means swapping to AfterShip / Australia Post later only touches this module.

export const TRACK_API = 'https://api.17track.net/track/v2.2';

/** Maps our stored carrier names to 17track numeric carrier codes. */
const CARRIER_CODES: Array<{ match: RegExp; code: number }> = [
  { match: /aus[\s-]?post|australia\s*post/i, code: 100002 },
  { match: /star[\s-]?track/i, code: 100530 },
  { match: /sendle/i, code: 100590 },
  { match: /couriers\s*please/i, code: 100286 },
  { match: /aramex|fastway/i, code: 100004 },
  { match: /tnt/i, code: 100006 },
  { match: /dhl/i, code: 100001 },
  { match: /toll/i, code: 100325 },
  { match: /fedex/i, code: 100003 },
];

export function carrierCode(provider?: string | null): number | null {
  const p = (provider || '').trim();
  if (!p) return null;
  return CARRIER_CODES.find((c) => c.match.test(p))?.code ?? null;
}

export interface NormalisedEvent {
  event_at: string;
  status: string | null;
  description: string;
  location: string | null;
}

export interface NormalisedTracking {
  number: string;
  status: string | null;
  events: NormalisedEvent[];
  deliveredAt: string | null;
  firstScanAt: string | null;
  notFound: boolean;
  exception: boolean;
}

/** 17track top-level statuses: NotFound, InfoReceived, InTransit, Expired,
 *  AvailableForPickup, OutForDelivery, DeliveryFailure, Delivered, Exception */
export function normaliseTrackInfo(number: string, trackInfo: any): NormalisedTracking {
  const status: string | null = trackInfo?.latest_status?.status ?? null;

  const rawEvents: any[] = [];
  const providers = trackInfo?.tracking?.providers ?? [];
  for (const p of providers) {
    for (const e of p?.events ?? []) rawEvents.push(e);
  }

  const events: NormalisedEvent[] = rawEvents
    .filter((e) => e?.time_iso || e?.time_utc)
    .map((e) => ({
      event_at: new Date(e.time_iso || e.time_utc).toISOString(),
      status: e.stage ?? e.sub_status ?? null,
      description: String(e.description || e.stage || 'Update').slice(0, 500),
      location: [e.location, e.address?.city, e.address?.state]
        .filter(Boolean)
        .join(', ') || null,
    }))
    .sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime());

  const delivered = status === 'Delivered';
  const deliveredAt = delivered
    ? events[0]?.event_at ?? new Date().toISOString()
    : null;
  const firstScanAt = events.length ? events[events.length - 1].event_at : null;

  return {
    number,
    status,
    events,
    deliveredAt,
    firstScanAt,
    notFound: status === 'NotFound',
    exception: status === 'Exception' || status === 'DeliveryFailure' || status === 'Expired',
  };
}

export function latestSummary(t: NormalisedTracking): string | null {
  const e = t.events[0];
  if (!e) return t.status ? humanStatus(t.status) : null;
  return `${humanStatus(t.status)} - ${e.description}`;
}

export function humanStatus(status: string | null): string {
  switch (status) {
    case 'InfoReceived': return 'Label created';
    case 'InTransit': return 'In transit';
    case 'OutForDelivery': return 'Out for delivery';
    case 'AvailableForPickup': return 'Ready for pickup';
    case 'Delivered': return 'Delivered';
    case 'DeliveryFailure': return 'Delivery failed';
    case 'Exception': return 'Delivery issue';
    case 'Expired': return 'Tracking expired';
    case 'NotFound': return 'Not found yet';
    default: return 'Tracking pending';
  }
}

async function trackFetch(path: string, body: unknown) {
  const key = Deno.env.get('SEVENTEENTRACK_API_KEY');
  if (!key) throw new Error('SEVENTEENTRACK_API_KEY is not configured');
  const res = await fetch(`${TRACK_API}${path}`, {
    method: 'POST',
    headers: { '17token': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${res.status}] ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Unparseable tracking response: ${text.slice(0, 300)}`);
  }
}

export function registerNumbers(items: Array<{ number: string; carrier?: number | null }>) {
  return trackFetch('/register', items.map((i) => (
    i.carrier ? { number: i.number, carrier: i.carrier } : { number: i.number }
  )));
}

export function getTrackInfo(items: Array<{ number: string; carrier?: number | null }>) {
  return trackFetch('/gettrackinfo', items.map((i) => (
    i.carrier ? { number: i.number, carrier: i.carrier } : { number: i.number }
  )));
}
