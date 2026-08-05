// Daily reconciliation: catches anything the webhook missed and alerts sellers
// whose tracking number the carrier still cannot find.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTrackInfo } from '../_shared/tracking.ts';
import { applyTracking } from '../_shared/applyTracking.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const providedCron = req.headers.get('x-cron-secret') ?? '';
  const authorized =
    (!!serviceKey && authHeader === `Bearer ${serviceKey}`) ||
    (!!cronSecret && providedCron === cronSecret);
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  try {
    // Only shipments that are still moving: not delivered, registered recently.
    const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const { data: shipments, error } = await admin
      .from('tracking_shipments')
      .select('id, order_group_id, seller_id, buyer_id, tracking_number, carrier_code, registered_at, not_found_notified_at')
      .is('delivered_at', null)
      .gte('created_at', cutoff)
      .limit(100);
    if (error) throw new Error(error.message);

    let synced = 0;
    let notified = 0;

    for (const s of shipments ?? []) {
      try {
        const info = await getTrackInfo([
          { number: s.tracking_number, carrier: s.carrier_code ? Number(s.carrier_code) : null },
        ]);
        const accepted = info?.data?.accepted?.[0];
        if (!accepted?.track_info) continue;
        const result = await applyTracking(admin, s, accepted.track_info, info);
        synced++;

        // Carrier still has no record 24h after we registered it: the seller
        // almost certainly typed the number wrong.
        const registeredAt = s.registered_at ? new Date(s.registered_at).getTime() : 0;
        const oldEnough = registeredAt && Date.now() - registeredAt > 24 * 60 * 60 * 1000;
        if (result.notFound && oldEnough && !s.not_found_notified_at) {
          await admin.from('notifications').insert({
            user_id: s.seller_id,
            type: 'tracking_not_found',
            title: 'Check your tracking number',
            message: `The carrier can't find tracking number ${s.tracking_number}. Please update it so your buyer can follow the parcel.`,
            related_order_id: null,
          });
          await admin
            .from('tracking_shipments')
            .update({ not_found_notified_at: new Date().toISOString() })
            .eq('id', s.id);
          notified++;
        }
      } catch (e) {
        console.warn('[tracking-sync] shipment failed', s.id, (e as Error).message);
      }
    }

    return new Response(JSON.stringify({ success: true, synced, notified }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[tracking-sync] error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
