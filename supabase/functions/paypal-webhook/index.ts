// paypal-webhook
// Backstop reconciler for PayPal events that originate outside the in-app
// refund flow (e.g. seller refunds from PayPal dashboard, disputes/chargebacks,
// captures that didn't sync). Without this, refunds issued out-of-band would
// never be recorded on Flea — buyers could ask again and get double-refunded.
//
// Configured with verify_jwt = false in supabase/config.toml because PayPal
// calls this endpoint directly with no Supabase JWT. We verify authenticity
// with PayPal's webhook signature verification API.
//
// Setup: in PayPal developer dashboard, create a webhook pointing at this
// function URL and subscribe to:
//   - PAYMENT.CAPTURE.COMPLETED
//   - PAYMENT.CAPTURE.REFUNDED
//   - PAYMENT.CAPTURE.REVERSED
//   - PAYMENT.CAPTURE.DENIED
//   - CUSTOMER.DISPUTE.CREATED
//   - CUSTOMER.DISPUTE.UPDATED
// Then set PAYPAL_WEBHOOK_ID secret to the webhook id PayPal returns.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo",
};

const PAYPAL_API = "https://api-m.paypal.com";

const serviceClient = createClient(
  Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
  Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } }
);

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
  return (await res.json()).access_token;
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
  if (!webhookId) {
    console.warn("[paypal-webhook] PAYPAL_WEBHOOK_ID not set — refusing event");
    return false;
  }
  const token = await getPayPalAccessToken();
  const verifyRes = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: req.headers.get("paypal-auth-algo"),
      cert_url: req.headers.get("paypal-cert-url"),
      transmission_id: req.headers.get("paypal-transmission-id"),
      transmission_sig: req.headers.get("paypal-transmission-sig"),
      transmission_time: req.headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!verifyRes.ok) return false;
  const j = await verifyRes.json();
  return j.verification_status === "SUCCESS";
}

async function notify(userId: string, type: string, title: string, message: string, orderId?: string) {
  try {
    await serviceClient.from("notifications").insert({
      user_id: userId, type, title, message, related_order_id: orderId ?? null,
    });
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ user_id: userId, notification: { type, title, message, related_order_id: orderId } }),
      });
    }
  } catch (e) { console.error("[paypal-webhook] notify failed", e); }
}

async function logEvent(event: any, fields: { order_id?: string|null; buyer_id?: string|null; seller_id?: string|null; amount?: number|null }) {
  try {
    await serviceClient.from("payment_events").insert({
      provider: "paypal",
      event_id: event.id,
      event_type: event.event_type,
      order_id: fields.order_id ?? null,
      buyer_id: fields.buyer_id ?? null,
      seller_id: fields.seller_id ?? null,
      amount: fields.amount ?? null,
      payload: event,
    });
  } catch (e: any) {
    if (e?.code !== "23505") console.error("[paypal-webhook] logEvent failed", e);
  }
}

async function findOrdersByPayPalRef(ref: string) {
  const { data } = await serviceClient
    .from("orders")
    .select("id, buyer_id, seller_id")
    .eq("checkout_reference", ref);
  return data ?? [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const rawBody = await req.text();
  const ok = await verifySignature(req, rawBody);
  if (!ok) {
    return new Response("Invalid signature", { status: 400, headers: corsHeaders });
  }

  const event = JSON.parse(rawBody);

  try {
    const resource = event.resource ?? {};
    // PayPal capture/refund resources include `supplementary_data.related_ids.order_id`.
    const ppOrderId =
      resource?.supplementary_data?.related_ids?.order_id ??
      resource?.id ?? null;

    let orders: Array<{ id: string; buyer_id: string; seller_id: string }> = [];
    if (ppOrderId) orders = await findOrdersByPayPalRef(ppOrderId) as any;

    switch (event.event_type) {
      case "PAYMENT.CAPTURE.REFUNDED":
      case "PAYMENT.CAPTURE.REVERSED": {
        for (const o of orders) {
          await serviceClient.from("orders")
            .update({ refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", o.id);
          await notify(o.buyer_id, "refund_processed", "Refund processed",
            "💸 Your refund has been processed and will appear in your PayPal account shortly.", o.id);
          await notify(o.seller_id, "refund_processed_seller", "Refund issued",
            "A refund was issued for one of your sales. Tap for details.", o.id);
        }
        break;
      }
      case "PAYMENT.CAPTURE.DENIED": {
        for (const o of orders) {
          await notify(o.buyer_id, "payment_failed", "Payment failed",
            "💳 Your PayPal payment didn't go through. Please try again or use a different method.", o.id);
        }
        break;
      }
      case "CUSTOMER.DISPUTE.CREATED":
      case "CUSTOMER.DISPUTE.UPDATED": {
        for (const o of orders) {
          await notify(o.seller_id, "dispute_opened", "⚠️ Payment disputed",
            "A buyer has opened a PayPal dispute. Please contact support immediately.", o.id);
        }
        break;
      }
      default:
        // log only
    }

    await logEvent(event, {
      order_id: orders[0]?.id ?? null,
      buyer_id: orders[0]?.buyer_id ?? null,
      seller_id: orders[0]?.seller_id ?? null,
      amount: typeof resource?.amount?.value === "string" ? Number(resource.amount.value) : null,
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[paypal-webhook] handler error:", error);
    return new Response(JSON.stringify({ received: true, error: error?.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
