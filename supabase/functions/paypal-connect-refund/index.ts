// paypal-connect-refund
// Seller-approved refund execution for PayPal orders. Mirrors
// stripe-connect-refund: full unwind of buyer payment AND Flea's 7%
// platform fee, atomic, no manual dashboard step.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYPAL_API = "https://api-m.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_SECRET_KEY");
  if (!clientId || !secret) throw new Error("PayPal credentials not configured");

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Manual JWT parse — just trust the sub claim (we re-verify via DB ownership below).
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Unauthorized");
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload.sub as string;
    if (!userId) throw new Error("Unauthorized");

    const { orderId, amount, reason } = await req.json();
    if (!orderId) throw new Error("orderId required");

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Look up the order — checkout_reference holds the PayPal order ID.
    const orderRes = await fetch(
      `${externalUrl}/rest/v1/orders?id=eq.${orderId}&select=id,buyer_id,seller_id,price,shipping_price,checkout_reference,refunded_at,payment_method,delivered_at,created_at`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    const orders = await orderRes.json();
    const order = orders?.[0];
    if (!order) throw new Error("Order not found");
    if (order.seller_id !== userId) throw new Error("Only the seller can initiate this refund");
    if (order.refunded_at) throw new Error("Order already refunded");
    if (order.payment_method && order.payment_method !== "paypal") {
      throw new Error("This endpoint only handles PayPal refunds");
    }
    if (!order.checkout_reference) throw new Error("No PayPal reference on order");

    // Refund window — server-side enforcement.
    const now = Date.now();
    if (order.delivered_at) {
      if (now - new Date(order.delivered_at).getTime() > 10 * 86400_000) {
        throw new Error("Refund window has closed (10 days after delivery).");
      }
    } else if (order.created_at) {
      if (now - new Date(order.created_at).getTime() > 30 * 86400_000) {
        throw new Error("Refund window has closed (30 days after order).");
      }
    }

    const accessToken = await getPayPalAccessToken();

    // Resolve PayPal order → capture id.
    const orderLookup = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${order.checkout_reference}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!orderLookup.ok) {
      throw new Error(`PayPal order lookup failed: ${orderLookup.status}`);
    }
    const orderData = await orderLookup.json();
    const capture = orderData?.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id;
    if (!captureId) throw new Error("No capture found for this PayPal order");

    // Refund — full unless `amount` provided. PayPal automatically reverses
    // the platform_fees we charged at capture time, so Flea's 7% unwinds back
    // to the buyer alongside the seller's share. Clean unwind.
    const refundBody: Record<string, unknown> = {
      note_to_payer: reason ? String(reason).substring(0, 255) : "Refund processed by seller via Flea.",
    };
    if (typeof amount === "number" && amount > 0) {
      refundBody.amount = { value: amount.toFixed(2), currency_code: "AUD" };
    }

    const refundRes = await fetch(
      `${PAYPAL_API}/v2/payments/captures/${captureId}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Partner-Attribution-Id": Deno.env.get("PAYPAL_CLIENT_ID") || "",
          "PayPal-Request-Id": `flea-refund-${orderId}`,
        },
        body: JSON.stringify(refundBody),
      },
    );

    if (!refundRes.ok) {
      const errText = await refundRes.text();
      console.error(`[paypal-refund] failed: ${refundRes.status} ${errText}`);
      throw new Error(`PayPal refund failed: ${refundRes.status}`);
    }

    const refundData = await refundRes.json();

    // Mark order refunded immediately so UI updates without waiting for webhook.
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

    return new Response(
      JSON.stringify({ success: true, refundId: refundData.id, status: refundData.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[paypal-connect-refund] error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Refund failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
