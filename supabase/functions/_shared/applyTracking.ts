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
  let refundedOrders = 0;

  // ---- Return leg: the buyer posting the item back to the seller ----
  if (isReturn) {
    if (t.deliveredAt && shipment.tracking_number) {
      const { data: returned, error: retErr } = await supabase
        .from('orders')
        .update({
          return_delivered_at: t.deliveredAt,
          updated_at: new Date().toISOString(),
        })
        .eq('return_tracking_number', shipment.tracking_number)
        .is('return_delivered_at', null)
        .is('refunded_at', null)
        .select('id, buyer_id, seller_id');
      if (retErr) console.error('[tracking] return delivery update failed:', retErr.message);

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      for (const order of returned ?? []) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/stripe-connect-refund`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              orderId: order.id,
              reason: 'requested_by_customer',
              mode: 'single',
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body?.error) {
            console.error('[tracking] return refund failed', order.id, body?.error ?? res.status);
            continue;
          }
          refundedOrders++;
          await supabase.from('notifications').insert([
            {
              user_id: order.buyer_id,
              type: 'refund_completed',
              title: '💸 Your refund is on its way.',
              message: 'Your return was delivered, so your refund has been issued.',
              related_order_id: order.id,
            },
            {
              user_id: order.seller_id,
              type: 'refund_completed',
              title: '📦 A return was delivered back to you.',
              message: 'The buyer has been refunded for this item.',
              related_order_id: order.id,
            },
          ]);
        } catch (e) {
          console.error('[tracking] return refund exception', order.id, (e as Error).message);
        }
      }
    }

    return {
      status: t.status,
      human: humanStatus(t.status),
      events: t.events.length,
      deliveredOrders: 0,
      refundedOrders,
      notFound: t.notFound,
      kind: 'return',
    };
  }

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
