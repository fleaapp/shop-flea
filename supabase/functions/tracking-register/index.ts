// Registers a shipped parcel with the tracking provider so we start receiving
// live carrier scans. Called by the seller's client right after the order is
// marked as shipped.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCorsHeaders, rejectUntrustedOrigin } from '../_shared/cors.ts';
import { carrierCode, registerNumbers, getTrackInfo } from '../_shared/tracking.ts';
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
    const orderGroupId = typeof body.order_group_id === 'string' ? body.order_group_id : null;
    const orderId = typeof body.order_id === 'string' ? body.order_id : null;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ---- Validate-only: check a number with the carrier before shipping ----
    if (body.validate_only === true) {
      const candidate = String(body.tracking_number ?? '').replace(/[\s-]+/g, '').toUpperCase();
      const carrierName = typeof body.carrier === 'string' ? body.carrier : null;
      if (!candidate) return json({ valid: false, message: 'Please enter a tracking number' }, 200);
      const code = carrierCode(carrierName);
      if (!code) {
        return json({ valid: false, message: 'Please choose a carrier from the list' }, 200);
      }
      try {
        const res = await registerNumbers([{ number: candidate, carrier: code }]);
        const rejected = res?.data?.rejected?.[0];
        const errCode = Number(rejected?.error?.code ?? 0);
        // -18019901 = already registered (fine). Anything in the invalid-number
        // family means the carrier will never recognise this number.
        const invalidCodes = [-18010012, -18010013, -18010014, -18010015];
        if (rejected && invalidCodes.includes(errCode)) {
          return json({
            valid: false,
            message: `That tracking number wasn't recognised by ${carrierName}. Check it and try again.`,
          }, 200);
        }
      } catch (e) {
        // Provider outage: don't block the seller, daily sync reconciles later.
        console.warn('[tracking-register] validation unavailable:', (e as Error).message);
      }
      return json({ valid: true }, 200);
    }

    if (!orderGroupId && !orderId) return json({ error: 'order_group_id or order_id required' }, 400);



    let q = admin
      .from('orders')
      .select('id, order_group_id, buyer_id, seller_id, tracking_provider, tracking_number')
      .limit(1);
    q = orderGroupId ? q.eq('order_group_id', orderGroupId) : q.eq('id', orderId!);
    const { data: orders, error: orderError } = await q;
    if (orderError) return json({ error: orderError.message }, 500);
    const order = orders?.[0];
    if (!order) return json({ error: 'Order not found' }, 404);
    if (order.seller_id !== userId) return json({ error: 'Forbidden' }, 403);

    const number = (order.tracking_number || '').trim();
    if (!number) return json({ error: 'No tracking number on this order' }, 400);

    const groupId = order.order_group_id ?? order.id;
    const code = carrierCode(order.tracking_provider);

    // Upsert the shipment record first so the webhook can always resolve it.
    const { data: shipment, error: shipError } = await admin
      .from('tracking_shipments')
      .upsert(
        {
          order_group_id: groupId,
          seller_id: order.seller_id,
          buyer_id: order.buyer_id,
          carrier_name: order.tracking_provider,
          carrier_code: code ? String(code) : null,
          tracking_number: number,
          registered_at: new Date().toISOString(),
        },
        { onConflict: 'order_group_id,tracking_number' },
      )
      .select('id, order_group_id, seller_id, buyer_id')
      .single();
    if (shipError) return json({ error: shipError.message }, 500);

    try {
      await registerNumbers([{ number, carrier: code }]);
    } catch (e) {
      // Already-registered numbers are fine; surface anything else.
      console.warn('[tracking-register] register warning:', (e as Error).message);
    }

    // Pull whatever the carrier already has so the buyer sees something now.
    try {
      const info = await getTrackInfo([{ number, carrier: code }]);
      const accepted = info?.data?.accepted?.[0];
      if (accepted?.track_info) {
        await applyTracking(admin, shipment, accepted.track_info, info);
      }
    } catch (e) {
      console.warn('[tracking-register] initial sync failed:', (e as Error).message);
    }

    return json({ success: true, shipment_id: shipment.id });
  } catch (e) {
    console.error('[tracking-register] error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
