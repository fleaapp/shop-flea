// auto-refund-unshipped
// Runs hourly via pg_cron. Refunds any order that is still `awaiting` (i.e.
// not marked as shipped with eligible tracking) 9 days after purchase.
// Uses Stripe reverse_transfer + refund_application_fee so the buyer's
// Secure Checkout Fee (4% + $0.70) is also returned, and pulls the sale
// amount back from the seller's Connect balance.

import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function firePush(userId: string, notification: Record<string, unknown>) {
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "https://teaicrimlqdayqpmxasc.supabase.co";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    await fetch(`${url}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ user_id: userId, notification }),
    });
  } catch (e) {
    console.error("[auto-refund-unshipped] push failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expectedKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const cutoff = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders, error } = await admin
      .from("orders")
      .select("id, buyer_id, seller_id, listing_id, price, shipping_price, checkout_reference, payment_method, refunded_at, shipped_at, created_at")
      .eq("status", "awaiting")
      .is("refunded_at", null)
      .is("shipped_at", null)
      .lte("created_at", cutoff);

    if (error) throw error;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    let refunded = 0;
    const failures: any[] = [];

    for (const order of orders ?? []) {
      try {
        // Demo (Apple Review) orders bypass Stripe.
        if (order.payment_method !== "demo") {
          if (!order.checkout_reference) throw new Error("no checkout_reference");
          const session = await stripe.checkout.sessions.retrieve(order.checkout_reference);
          const paymentIntentId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
          if (!paymentIntentId) throw new Error("no payment_intent");

          await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reverse_transfer: true,
            refund_application_fee: true,
            reason: "requested_by_customer",
            metadata: {
              flea_order_id: order.id,
              flea_seller_id: order.seller_id,
              flea_buyer_id: order.buyer_id,
              flea_auto_refund: "unshipped_9d",
            },
          }, { idempotencyKey: `flea-auto-refund-${order.id}` });
        }

        await admin
          .from("orders")
          .update({
            refunded_at: new Date().toISOString(),
            refund_reason: "auto_unshipped_9d",
          })
          .eq("id", order.id);

        // Reactivate the listing so it's not stuck as sold.
        await admin
          .from("listings")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", order.listing_id);

        // Notify buyer and seller.
        await admin.from("notifications").insert([
          {
            user_id: order.buyer_id,
            type: "order_auto_refunded",
            title: "Order refunded",
            message: "💸 Your order was automatically refunded because the seller didn't ship within 9 days. Funds will appear in 5 to 10 days.",
            related_listing_id: order.listing_id,
            related_user_id: order.seller_id,
            related_order_id: order.id,
          },
          {
            user_id: order.seller_id,
            type: "sale_auto_refunded",
            title: "Sale auto-refunded",
            message: "⚠️ Your sale was automatically refunded because tracking wasn't added within 9 days. Repeated auto-refunds may affect your account.",
            related_listing_id: order.listing_id,
            related_user_id: order.buyer_id,
            related_order_id: order.id,
          },
        ]);

        firePush(order.buyer_id, { type: "order_auto_refunded", title: "Order refunded", message: "Your order was automatically refunded because the seller didn't ship within 9 days." });
        firePush(order.seller_id, { type: "sale_auto_refunded", title: "Sale auto-refunded", message: "Your sale was auto-refunded because tracking wasn't added within 9 days." });

        // Audit trail.
        try {
          await admin.from("payment_events").insert({
            event_type: "auto_refund_unshipped",
            order_id: order.id,
            metadata: { reason: "unshipped_9d", days: 9 },
          });
        } catch (_) { /* payment_events schema tolerant */ }

        refunded += 1;
      } catch (e: any) {
        console.error(`[auto-refund-unshipped] order ${order.id} failed`, e?.message);
        failures.push({ orderId: order.id, error: e?.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, refunded, failures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[auto-refund-unshipped] fatal", e);
    return new Response(JSON.stringify({ error: e?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
