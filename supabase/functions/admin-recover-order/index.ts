// admin-recover-order
// One-shot recovery: given a succeeded Stripe PaymentIntent id, reconstruct
// the order rows in the DB as if finalize-checkout had run — for cases where
// the buyer lost localStorage / exited the syncing screen.
//
// Reads PI metadata (item_ids, flea_buyer_id, flea_seller_id, coupon_code)
// from Stripe, joins listing + buyer_addresses, and inserts orders with
// status="awaiting". Marks listings sold, clears cart, fires notifications.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { paymentIntentId } = (await req.json()) as { paymentIntentId?: string };
    if (!paymentIntentId || !paymentIntentId.startsWith("pi_")) {
      return json({ error: "paymentIntentId (pi_...) is required" }, 400);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded" && pi.status !== "requires_capture") {
      return json({ error: `PI not paid (status=${pi.status})` }, 400);
    }

    const md = (pi.metadata ?? {}) as Record<string, string>;
    const buyerId = md.flea_buyer_id;
    const sellerId = md.flea_seller_id;
    const itemIds = (md.item_ids || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!buyerId || !sellerId || itemIds.length === 0) {
      return json({ error: "PI metadata missing", metadata: md }, 400);
    }

    const svc = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Idempotency: check by listing + buyer since checkout_reference column may not exist.
    const prior = await svc
      .from("orders")
      .select("id, listing_id, buyer_id, created_at")
      .eq("buyer_id", buyerId)
      .in("listing_id", itemIds);
    if ((prior.data ?? []).length > 0) {
      return json({ ok: true, alreadyProcessed: true, orders: prior.data });
    }

    // Fetch listings
    const { data: listingRows, error: lErr } = await svc
      .from("listings")
      .select("id, user_id, title, price, shipping_price, status")
      .in("id", itemIds);
    if (lErr) throw lErr;
    const listingMap = new Map(
      (listingRows ?? []).map((r: any) => [r.id as string, r as any]),
    );
    const items = itemIds
      .map((id) => listingMap.get(id))
      .filter((x: any): x is any => !!x);
    if (items.length === 0) return json({ error: "listings not found" }, 400);

    // Buyer shipping address
    const { data: addr } = await svc
      .from("buyer_addresses")
      .select("first_name,last_name,address,suburb,state,postcode")
      .eq("user_id", buyerId)
      .maybeSingle();

    const shippingByItem = items.map((i: any) => Number(i.shipping_price || 0));
    const orderGroupId = crypto.randomUUID();

    const inserts = items.map((item: any, idx: number) => ({
      order_group_id: orderGroupId,
      listing_id: item.id,
      buyer_id: buyerId,
      seller_id: item.user_id,
      price: Number(item.price),
      shipping_price: idx === 0 ? shippingByItem[idx] : 0,
      status: "awaiting",
      payment_method: "stripe",
      checkout_reference: paymentIntentId,
      shipping_first_name: (addr as any)?.first_name ?? null,
      shipping_last_name: (addr as any)?.last_name ?? null,
      shipping_address: (addr as any)?.address ?? null,
      shipping_city: (addr as any)?.suburb ?? null,
      shipping_state: (addr as any)?.state ?? null,
      shipping_postcode: (addr as any)?.postcode ?? null,
    }));

    const ins = await svc.from("orders").insert(inserts).select("id, listing_id, seller_id");
    if (ins.error) throw ins.error;

    // Flip listings sold
    await svc
      .from("listings")
      .update({ status: "sold", updated_at: new Date().toISOString() })
      .in("id", items.map((i: any) => i.id));

    // Clear cart
    await svc
      .from("cart_items")
      .delete()
      .eq("user_id", buyerId)
      .in("listing_id", items.map((i: any) => i.id));

    // Notify seller(s)
    const notifs = (ins.data ?? []).map((o: any) => {
      const listing = listingMap.get(o.listing_id) as any;
      return {
        user_id: o.seller_id,
        type: "item_sold",
        title: "Item Sold",
        message: listing?.title ?? "Your item",
        related_listing_id: o.listing_id,
        related_user_id: buyerId,
        related_order_id: o.id,
      };
    });
    if (notifs.length) await svc.from("notifications").insert(notifs);

    // Push notifications (best-effort)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey =
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
        Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
      for (const o of ins.data ?? []) {
        const listing = listingMap.get((o as any).listing_id) as any;
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            user_id: (o as any).seller_id,
            notification: {
              type: "item_sold",
              title: "Item Sold",
              message: `🎉🤑 Cha-ching! Your item "${listing?.title ?? ""}" has just sold.`,
              related_listing_id: (o as any).listing_id,
              related_order_id: (o as any).id,
            },
          }),
        });
      }
    } catch (_e) {}

    return json({ ok: true, alreadyProcessed: false, orders: ins.data, metadata: md });
  } catch (error) {
    console.error("[admin-recover-order] error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
