// Receives live carrier scan pushes from the tracking provider.
// Public endpoint: authenticated by a shared secret in the query string, not JWT.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyTracking } from '../_shared/applyTracking.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('TRACKING_WEBHOOK_SECRET') ?? '';
  const provided = new URL(req.url).searchParams.get('token') ?? '';
  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await req.json();
    const data = payload?.data ?? payload;
    const number: string | undefined = data?.number;
    const trackInfo = data?.track_info;
    if (!number || !trackInfo) {
      return new Response(JSON.stringify({ ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: shipments, error } = await admin
      .from('tracking_shipments')
      .select('id, order_group_id, seller_id, buyer_id, kind, tracking_number')
      .eq('tracking_number', number);
    if (error) throw new Error(error.message);
    if (!shipments?.length) {
      console.warn('[tracking-webhook] no shipment for number', number);
      return new Response(JSON.stringify({ ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = [];
    for (const shipment of shipments) {
      results.push(await applyTracking(admin, shipment, trackInfo, payload));
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[tracking-webhook] error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
