import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function firePushNotification(userId: string, notification: Record<string, unknown>) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://teaicrimlqdayqpmxasc.supabase.co";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ user_id: userId, notification }),
    });
  } catch (e) {
    console.error("[shipping-reminders] Push error:", e);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '',
      Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const now = new Date();
    console.log(`[shipping-reminders] Running at ${now.toISOString()}`);

    // ── 3-day reminder ──────────────────────────────────────────────────────
    // Orders that are 3-7 days old, still awaiting, and haven't had a 3d reminder yet
    const { data: orders3d, error: err3d } = await supabaseAdmin
      .from('orders')
      .select('id, seller_id, buyer_id, listing_id, created_at')
      .eq('status', 'awaiting')
      .lte('created_at', new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .gte('created_at', new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString());

    if (err3d) throw err3d;

    let sent3d = 0;
    for (const order of (orders3d ?? [])) {
      // Check if a 3-day reminder was already sent for this order/listing
      const { data: existing } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('user_id', order.seller_id)
        .eq('type', 'shipping_reminder_3d')
        .eq('related_listing_id', order.listing_id)
        .maybeSingle();

      if (existing) continue;

      const { error: insertErr } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: order.seller_id,
          type: 'shipping_reminder_3d',
          title: 'Shipping Reminder',
          message: '🚨 Reminder: Your buyer is waiting 👀 Ship now & update tracking. 📦',
          related_listing_id: order.listing_id,
          related_user_id: order.buyer_id,
        });

      if (insertErr) {
        console.error(`[3d] Failed for order ${order.id}:`, insertErr);
      } else {
        sent3d++;
        console.log(`[3d] Sent reminder for order ${order.id}`);
        await firePushNotification(order.seller_id, {
          type: 'shipping_reminder_3d',
          title: 'Shipping Reminder',
          message: '🚨 Reminder: Your buyer is waiting 👀 Ship now & update tracking. 📦',
          related_listing_id: order.listing_id,
        });
      }
    }

    // ── 6-day reminder ──────────────────────────────────────────────────────
    // Orders that are 6+ days old, still awaiting, and haven't had a 6d reminder yet
    const { data: orders6d, error: err6d } = await supabaseAdmin
      .from('orders')
      .select('id, seller_id, buyer_id, listing_id, created_at')
      .eq('status', 'awaiting')
      .lte('created_at', new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString());

    if (err6d) throw err6d;

    let sent6d = 0;
    for (const order of (orders6d ?? [])) {
      const { data: existing } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('user_id', order.seller_id)
        .eq('type', 'shipping_reminder_6d')
        .eq('related_listing_id', order.listing_id)
        .maybeSingle();

      if (existing) continue;

      const { error: insertErr } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: order.seller_id,
          type: 'shipping_reminder_6d',
          title: 'Urgent Shipping Reminder',
          message: '🚨 Urgent action needed: Your sale is 6 days overdue. Ship today to avoid issues. 🚚',
          related_listing_id: order.listing_id,
          related_user_id: order.buyer_id,
        });

      if (insertErr) {
        console.error(`[6d] Failed for order ${order.id}:`, insertErr);
      } else {
        sent6d++;
        console.log(`[6d] Sent reminder for order ${order.id}`);
      }
    }

    const result = {
      ok: true,
      sent3d,
      sent6d,
      timestamp: now.toISOString(),
    };

    console.log('[shipping-reminders] Done:', result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[shipping-reminders] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
