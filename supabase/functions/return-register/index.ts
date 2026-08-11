// return-register
// The buyer submits tracking for a return parcel they have posted back to the
// seller. We validate the number with the carrier, store it on the order,
// create a `return` shipment so 17track pushes scans to us, and notify both
// parties. The refund itself fires automatically once the return is scanned
// as delivered (see _shared/applyTracking.ts).
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
    const orderId = typeof body.order_id === 'string' ? body.order_id : null;
    const carrier = typeof body.carrier === 'string' ? body.carrier : null;
    const number = String(body.tracking_number ?? '').replace(/[\s-]+/g, '').toUpperCase();
    if (!orderId) return json({ error: 'order_id required' }, 400);
    if (!carrier) return json({ error: 'Please choose a carrier from the list' }, 400);
    if (!number) return json({ error: 'Please enter a tracking number' }, 400);

    const code = carrierCode(carrier);
    if (!code) return json({ error: 'Please choose a carrier from the list' }, 400);

    // Validate the number with the carrier before we commit it.
    try {
      const res = await registerNumbers([{ number, carrier: code }]);
      const rejected = res?.data?.rejected?.[0];
      const errCode = Number(rejected?.error?.code ?? 0);
      const invalidCodes = [-18010012, -18010013, -18010014, -18010015];
      if (rejected && invalidCodes.includes(errCode)) {
        return json(
          { error: `That tracking number wasn't recognised by ${carrier}. Check it and try again.` },
          400,
        );
      }
    } catch (e) {
      console.warn('[return-register] validation unavailable:', (e as Error).message);
    }

    // Store on the order via the buyer-scoped RPC (enforces ownership and
    // that a return is actually required).
    const { data: updated, error: rpcError } = await anon.rpc('submit_return_tracking', {
      p_order_id: orderId,
      p_provider: carrier,
      p_number: number,
    });
    if (rpcError) return json({ error: rpcError.message }, 400);
    const order = (updated as any[])?.[0];
    if (!order) return json({ error: 'No return is open for this order.' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

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
        message: `Tracking ${number} with ${carrier}. The buyer is refunded once it is delivered.`,
        related_order_id: order.id,
      },
      {
        user_id: order.buyer_id,
        type: 'return_posted',
        title: '✈️ Return tracking added.',
        message: 'Your refund is issued automatically once the seller receives the item.',
        related_order_id: order.id,
      },
    ]);

    return json({ success: true, shipment_id: shipment.id });
  } catch (e) {
    console.error('[return-register] error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
