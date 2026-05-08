// stripe-connect-refund
// Seller-approved refund execution. Called from the in-app refund flow AFTER
// the seller has explicitly approved a buyer's refund request (or after
// policy-based escalation). Stripe handles only the financial execution —
// approval/decision logic happens in the app.
//
// Uses reverse_transfer + refund_application_fee so the funds AND Flea's 7%
// platform fee are unwound cleanly back through the Connect account.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId, amount, reason } = await req.json();
    if (!orderId) throw new Error("orderId required");

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Fetch order and verify the caller is the seller.
    const orderRes = await fetch(
      `${externalUrl}/rest/v1/orders?id=eq.${orderId}&select=id,buyer_id,seller_id,price,shipping_price,checkout_reference,refunded_at,payment_method`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    const orders = await orderRes.json();
    const order = orders?.[0];
    if (!order) throw new Error("Order not found");
    if (order.seller_id !== user.id) throw new Error("Only the seller can initiate this refund");
    if (order.refunded_at) throw new Error("Order already refunded");
    if (order.payment_method && order.payment_method !== "stripe") {
      throw new Error("Refund only supported for Stripe orders here");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Resolve checkout session → payment intent.
    if (!order.checkout_reference) throw new Error("No checkout reference on order");
    const session = await stripe.checkout.sessions.retrieve(order.checkout_reference);
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
    if (!paymentIntentId) throw new Error("No payment intent for this order");

    // Refund — full unless `amount` provided. reverse_transfer pulls the
    // seller's share back; refund_application_fee returns Flea's 7% to the
    // buyer too. Net effect: clean unwind, no party out of pocket on the
    // platform side.
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(typeof amount === "number" && amount > 0
        ? { amount: Math.round(amount * 100) }
        : {}),
      reverse_transfer: true,
      refund_application_fee: true,
      reason: reason === "fraudulent" || reason === "duplicate" ? reason : "requested_by_customer",
      metadata: {
        flea_order_id: orderId,
        flea_seller_id: user.id,
        flea_buyer_id: order.buyer_id,
      },
    });

    // Mark order refunded. The webhook will also handle this, but we set it
    // immediately so the UI updates without waiting for the webhook.
    await fetch(`${externalUrl}/rest/v1/orders?id=eq.${orderId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ refunded_at: new Date().toISOString() }),
    });

    return new Response(JSON.stringify({ success: true, refundId: refund.id, status: refund.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[stripe-connect-refund] error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Refund failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
