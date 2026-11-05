// return-register
// The buyer submits tracking for a return parcel they have posted back to the
// seller. We validate the number with the carrier, store it on the order,
// create a `return` shipment so 17track pushes scans to us, and notify both
// parties. The refund itself fires automatically once the return is scanned
// as delivered (see _shared/applyTracking.ts).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCorsHeaders, rejectUntrustedOrigin } from '../_shared/cors.ts';
import { carrierCode, registerNumbers, getTrackInfo, normaliseTrackInfo } from '../_shared/tracking.ts';
import { applyTracking } from '../_shared/applyTracking.ts';

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = rejectUntrustedOrigin(req);
  if (blocked) return blocked;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await anon.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.order_id === 'string' ? body.order_id : null;
    const carrier = typeof body.carrier === 'string' ? body.carrier : null;
    const number = String(body.tracking_number ?? '').replace(/[\s-]+/g, '').toUpperCase();
    if (!orderId) return json({ error: 'order_id required' }, 400);
    if (!carrier) return json({ error: 'Please choose a carrier from the list' }, 400);
    if (!number) return json({ error: 'Please enter a tracking number' }, 400);

    const code = carrierCode(carrier);
    if (!code) return json({ error: 'Please choose a carrier from the list' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: order, error: orderError } = await admin.from('orders').select('*').eq('id', orderId).eq('buyer_id', userId).single();
    if (orderError || !order || !order.return_required_at || order.refunded_at || order.return_closed_at || order.return_delivered_at) return json({ error: 'No return is open for this order.' }, 400);
    if (Date.parse(order.return_deadline_at ?? '') <= Date.now()) return json({ error: 'The return posting deadline has passed. Please contact Flea.' }, 400);
    if (!/^[A-Z0-9]{6,40}$/.test(number)) return json({ error: 'Please check the tracking number.' }, 400);
    const { data: used, error: usedError } = await admin.from('tracking_shipments').select('order_group_id,kind,buyer_id,seller_id').eq('tracking_number', number);
    if (usedError) throw usedError;
    if ((used ?? []).some(s => s.kind !== 'return' || s.order_group_id !== order.order_group_id || s.buyer_id !== userId || s.seller_id !== order.seller_id)) return json({ error: 'That tracking number is already used for another parcel.' }, 400);
    if (number === String(order.tracking_number ?? '').replace(/[\s-]+/g, '').toUpperCase()) return json({ error: 'Return tracking must be different from the original delivery.' }, 400);
    try {
      const registered = await registerNumbers([{ number, carrier: code }]);
      const rejection = registered?.data?.rejected?.[0];
      // -18010010 denotes a previously registered parcel; all other errors fail closed.
      if (rejection && Number(rejection.error?.code) !== -18010010) return json({ error: 'The carrier could not verify that number. Please check it.' }, 400);
      const info = await getTrackInfo([{ number, carrier: code }]);
      const payload = info?.data?.accepted?.[0]?.track_info;
      const track = payload ? normaliseTrackInfo(number, payload) : null;
      if (!track || track.notFound || track.exception || !track.firstScanAt) return json({ error: 'The carrier has not scanned this parcel yet. Try again after it is scanned.' }, 409);
      if (Date.parse(track.firstScanAt) < Date.parse(order.return_required_at)) return json({ error: 'That parcel was posted before this return was approved.' }, 400);
    } catch (e) {
      console.warn('[return-register] validation unavailable:', (e as Error).message);
      return json({ error: 'We could not check the carrier. Please try again shortly.' }, 503);
    }
    const { error: saveError } = await admin.from('orders').update({
      return_tracking_provider: carrier, return_tracking_number: number,
      return_posted_at: order.return_posted_at ?? new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', order.id).eq('buyer_id', userId).is('return_closed_at', null).is('refunded_at', null);
    if (saveError) throw saveError;

    const { data: shipment, error: shipError } = await admin
      .from('tracking_shipments')
      .upsert(
        {
          order_group_id: order.order_group_id ?? order.id,
          seller_id: order.seller_id,
          buyer_id: order.buyer_id,
          carrier_name: carrier,
          carrier_code: String(code),
          tracking_number: number,
          kind: 'return',
          registered_at: new Date().toISOString(),
          not_found_notified_at: null,
          is_exception: false,
        },
        { onConflict: 'order_group_id,tracking_number' },
      )
      .select('id, order_group_id, seller_id, buyer_id, kind, tracking_number')
      .single();
    if (shipError) return json({ error: shipError.message }, 500);

    // Pull whatever the carrier already knows so both sides see progress now.
    try {
      const info = await getTrackInfo([{ number, carrier: code }]);
      const accepted = info?.data?.accepted?.[0];
      if (accepted?.track_info) {
        await applyTracking(admin, shipment, accepted.track_info, info);
      }
    } catch (e) {
      console.warn('[return-register] initial sync failed:', (e as Error).message);
    }

    await admin.from('notifications').insert([
      {
        user_id: order.seller_id,
        type: 'return_posted',
        title: '📦 A return is on its way back to you.',
        message: `Tracking ${number} with ${carrier}. Flea reviews the return before issuing the refund.`,
        related_order_id: order.id,
      },
      {
        user_id: order.buyer_id,
        type: 'return_posted',
        title: '✈️ Return tracking added.',
        message: 'Flea reviews the return delivery before issuing your refund.',
        related_order_id: order.id,
      },
    ]);

    return json({ success: true, shipment_id: shipment.id });
  } catch (e) {
    console.error('[return-register] error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
