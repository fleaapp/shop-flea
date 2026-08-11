import { normaliseTrackInfo, latestSummary, humanStatus, type NormalisedTracking } from './tracking.ts';

/**
 * Persists a normalised tracking payload for a shipment and advances the
 * order lifecycle when the carrier confirms delivery.
 *
 * Safety: carrier data only ever moves an order forward. Orders that are
 * refunded, cancelled or completed are never touched.
 */
export async function applyTracking(
  supabase: any,
  shipment: {
    id: string;
    order_group_id: string;
    seller_id: string;
    buyer_id: string;
    kind?: string | null;
    tracking_number?: string | null;
  },
  trackInfo: any,
  rawPayload: unknown,
) {
  const t: NormalisedTracking = normaliseTrackInfo('', trackInfo);
  const isReturn = shipment.kind === 'return';

  if (t.events.length) {
    const rows = t.events.map((e) => ({
      shipment_id: shipment.id,
      event_at: e.event_at,
      status: e.status,
      description: e.description,
      location: e.location,
    }));
    const { error } = await supabase
      .from('tracking_events')
      .upsert(rows, { onConflict: 'shipment_id,event_at,description', ignoreDuplicates: true });
    if (error) console.error('[tracking] event upsert failed:', error.message);
  }

  await supabase
    .from('tracking_shipments')
    .update({
      provider_status: t.status,
      latest_event_summary: latestSummary(t),
      latest_event_at: t.events[0]?.event_at ?? null,
      first_scan_at: t.firstScanAt,
      delivered_at: t.deliveredAt,
      is_exception: t.exception,
      last_synced_at: new Date().toISOString(),
      raw_payload: rawPayload as any,
    })
    .eq('id', shipment.id);

  let deliveredOrders = 0;
  if (t.deliveredAt) {
    // A carrier scan can land before the seller pressed "Mark as shipped".
    // Stamp the shipped state first so buyers never skip that step (and the
    // shipped timeline entry stays accurate).
    await supabase
      .from('orders')
      .update({
        status: 'shipped',
        shipped_at: t.firstScanAt ?? t.deliveredAt,
        updated_at: new Date().toISOString(),
      })
      .eq('order_group_id', shipment.order_group_id)
      .eq('status', 'awaiting');

    // Carrier-confirmed delivery: stamp delivery, open the 48h dispute window.
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: t.deliveredAt,
        dispute_window_ends_at: new Date(
          new Date(t.deliveredAt).getTime() + 2 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        tracking_approved_at: new Date().toISOString(),
        pending_admin_delivery_review: false,
        updated_at: new Date().toISOString(),
      })
      .eq('order_group_id', shipment.order_group_id)
      .eq('status', 'shipped')
      .select('id');
    if (error) console.error('[tracking] delivery update failed:', error.message);
    deliveredOrders = data?.length ?? 0;
  }

  return { status: t.status, human: humanStatus(t.status), events: t.events.length, deliveredOrders, notFound: t.notFound };
}
