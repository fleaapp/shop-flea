// Registers a shipped parcel with the tracking provider so we start receiving
// live carrier scans. Called by the seller's client right after the order is
// marked as shipped.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCorsHeaders, rejectUntrustedOrigin } from '../_shared/cors.ts';
import { carrierCode, registerNumbers, getTrackInfo, normaliseTrackInfo } from '../_shared/tracking.ts';
import { normaliseTrackingNumber, hasShipmentEvidence } from '../_shared/trackingSafety.ts';
import { applyTracking } from '../_shared/applyTracking.ts';
import { sendTransactionalEmail, getUserEmail, wantsOrderEmails } from '../_shared/sendTransactionalEmail.ts';

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

    const verifyParcel = async (candidate: string, carrierName: string, groupId: string, createdAt: string) => {
      const code = carrierCode(carrierName);
      if (!code || !/^[A-Z0-9]{6,50}$/.test(candidate)) throw new Error('Please enter valid tracking and choose a carrier from the list.');
      const { data: used, error: usedError } = await admin.from('tracking_shipments').select('order_group_id').eq('tracking_number', candidate).neq('order_group_id', groupId).limit(1);
      if (usedError) throw usedError;
      if (used?.length) throw new Error('This tracking number belongs to another order.');
      await registerNumbers([{ number: candidate, carrier: code }]);
      const result = await getTrackInfo([{ number: candidate, carrier: code }]);
      const accepted = result?.data?.accepted?.[0];
      if (!accepted?.track_info || !hasShipmentEvidence(normaliseTrackInfo(candidate, accepted.track_info), createdAt)) {
        throw new Error('The carrier has not confirmed a new shipment for this order. Wait for its first scan and try again.');
      }
    };

    // ---- Validate-only: previews cannot authorize an order update ----
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
        const info = await getTrackInfo([{ number: candidate, carrier: code }]);
        const trackInfo = info?.data?.accepted?.[0]?.track_info;
        if (!trackInfo || normaliseTrackInfo(candidate, trackInfo).notFound) return json({ valid: false, message: 'Wait for the carrier to scan this parcel, then try again.' });
      } catch (e) {
        console.warn('[tracking-register] validation unavailable:', (e as Error).message);
        return json({ valid: false, message: 'Tracking could not be checked. Please try again.' });
      }
      return json({ valid: true }, 200);
    }

    if (!orderGroupId && !orderId) return json({ error: 'order_group_id or order_id required' }, 400);



    let q = admin
      .from('orders')
      .select('id, order_group_id, buyer_id, seller_id, listing_id, created_at, tracking_provider, tracking_number')
      .limit(1);
    if (orderGroupId) q = q.eq('order_group_id', orderGroupId);
    else if (orderId) q = q.eq('id', orderId);
    const { data: orders, error: orderError } = await q;
    if (orderError) return json({ error: orderError.message }, 500);
    const order = orders?.[0];
    if (!order) return json({ error: 'Order not found' }, 404);
    if (order.seller_id !== userId) return json({ error: 'Forbidden' }, 403);

    if (body.verify_for_shipping === true) {
      const candidate = normaliseTrackingNumber(String(body.tracking_number ?? ''));
      const carrier = String(body.carrier ?? '');
      const groupId = order.order_group_id ?? order.id;
      try { await verifyParcel(candidate, carrier, groupId, order.created_at); }
      catch (error) { return json({ error: error instanceof Error ? error.message : 'Tracking verification unavailable.' }, 400); }
      const { error } = await admin.from('shipping_validation').upsert({ seller_id: userId, order_group_id: groupId, tracking_number: candidate, carrier_name: carrier, verified_at: new Date().toISOString() }, { onConflict: 'order_group_id,tracking_number' });
      if (error) throw error;
      return json({ success: true });
    }

    // ---- Correct a mistyped tracking number on an already-shipped order ----
    const replacement = String(body.new_tracking_number ?? '').replace(/[\s-]+/g, '').toUpperCase();
    if (replacement) {
      const newCarrier = typeof body.carrier === 'string' ? body.carrier : order.tracking_provider;
      const newCode = carrierCode(newCarrier);
      if (!newCode) return json({ error: 'Please choose a carrier from the list' }, 400);
      try { await verifyParcel(replacement, newCarrier, order.order_group_id ?? order.id, order.created_at); }
      catch (error) { return json({ error: error instanceof Error ? error.message : 'Tracking verification unavailable.' }, 400); }

      let uq = admin
        .from('orders')
        .update({
          tracking_provider: newCarrier,
          tracking_number: replacement,
          tracking_rejected_at: null,
          tracking_rejection_reason: null,
          tracking_approved_at: null,
          tracking_approved_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('seller_id', userId)
        .in('status', ['shipped']);
      uq = order.order_group_id
        ? uq.eq('order_group_id', order.order_group_id)
        : uq.eq('id', order.id);
      const { error: updErr } = await uq;
      if (updErr) return json({ error: updErr.message }, 500);

      const gid = order.order_group_id ?? order.id;
      const { data: newShipment, error: newShipErr } = await admin
        .from('tracking_shipments')
        .upsert(
          {
            order_group_id: gid,
            seller_id: order.seller_id,
            buyer_id: order.buyer_id,
            carrier_name: newCarrier,
            carrier_code: String(newCode),
            tracking_number: replacement,
            registered_at: new Date().toISOString(),
            not_found_notified_at: null,
            is_exception: false,
          },
          { onConflict: 'order_group_id,tracking_number' },
        )
        .select('id, order_group_id, seller_id, buyer_id')
        .single();
      if (newShipErr) return json({ error: newShipErr.message }, 500);

      try {
        await registerNumbers([{ number: replacement, carrier: newCode }]);
        const info = await getTrackInfo([{ number: replacement, carrier: newCode }]);
        const accepted = info?.data?.accepted?.[0];
        if (accepted?.track_info) {
          await applyTracking(admin, newShipment, accepted.track_info, info);
        }
      } catch (e) {
        console.warn('[tracking-register] update sync failed:', (e as Error).message);
      }

      return json({ success: true, updated: true, shipment_id: newShipment.id });
    }

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

    // Notify buyer by email that their order has shipped.
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const buyerEmail = await getUserEmail(supabaseUrl, serviceKey, order.buyer_id);
      if (buyerEmail && (await wantsOrderEmails(supabaseUrl, serviceKey, order.buyer_id))) {
        const { data: orderRow } = await admin
          .from('orders')
          .select('order_number, listing_id')
          .eq('id', order.id)
          .maybeSingle();
        const { data: listingRow } = await admin
          .from('listings')
          .select('title')
          .eq('id', orderRow?.listing_id ?? order.listing_id)
          .maybeSingle();
        const carrierName = order.tracking_provider ?? '';
        const trackingUrl = carrierName.toLowerCase().includes('auspost') || carrierName.toLowerCase().includes('australia post')
          ? `https://auspost.com.au/mypost/track/#/details/${number}`
          : undefined;
        await sendTransactionalEmail({
          supabaseUrl,
          serviceKey,
          templateName: 'buyer-order-shipped',
          recipientEmail: buyerEmail,
          idempotencyKey: `buyer-order-shipped-${groupId}`,
          templateData: {
            orderNumber: orderRow?.order_number ?? '',
            itemTitle: listingRow?.title ?? '',
            trackingNumber: number,
            carrier: carrierName,
            trackingUrl,
          },
        });
      }
    } catch (e) {
      console.error('[tracking-register] shipped email error:', e);
    }

    return json({ success: true, shipment_id: shipment.id });
  } catch (e) {
    console.error('[tracking-register] error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
