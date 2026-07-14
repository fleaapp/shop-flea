// Stripe webhook handler for payment failures, refunds, disputes.
// Intentionally configured with verify_jwt = false in supabase/config.toml
// because Stripe calls this endpoint directly without a Supabase JWT.
// Authenticity is verified via Stripe's webhook signature instead.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const serviceClient = createClient(
  Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
  Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function sendPush(userId: string, notification: Record<string, unknown>) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return;
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ user_id: userId, notification }),
    });
  } catch (e) {
    console.error("[stripe-webhook] push failed", e);
  }
}

async function notify(userId: string, type: string, title: string, message: string, orderId?: string) {
  try {
    await serviceClient.from("notifications").insert({
      user_id: userId, type, title, message, related_order_id: orderId ?? null,
    });
    await sendPush(userId, { type, title, message, related_order_id: orderId });
  } catch (e) {
    console.error("[stripe-webhook] notify failed", e);
  }
}

async function logEvent(event: Stripe.Event, fields: {
  order_id?: string | null;
  buyer_id?: string | null;
  seller_id?: string | null;
  amount?: number | null;
}) {
  try {
    await serviceClient.from("payment_events").insert({
      provider: "stripe",
      event_id: event.id,
      event_type: event.type,
      order_id: fields.order_id ?? null,
      buyer_id: fields.buyer_id ?? null,
      seller_id: fields.seller_id ?? null,
      amount: fields.amount ?? null,
      payload: event as unknown as Record<string, unknown>,
    });
  } catch (e: any) {
    // 23505 = duplicate event id (already processed) — safe to ignore
    if (e?.code !== "23505") console.error("[stripe-webhook] logEvent failed", e);
  }
}

async function findOrdersByCheckoutSession(sessionId: string) {
  const { data } = await serviceClient
    .from("orders")
    .select("id, buyer_id, seller_id, listing_id")
    .eq("checkout_reference", sessionId);
  return data ?? [];
}

async function findOrdersByPaymentIntent(piId: string) {
  // Resolve PI -> checkout session
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 });
    const session = sessions.data[0];
    if (session?.id) return await findOrdersByCheckoutSession(session.id);
  } catch (e) {
    console.error("[stripe-webhook] PI->session lookup failed", e);
  }
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const sig = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!sig || !secret) throw new Error("Missing signature or webhook secret");
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (err: any) {
    console.error("[stripe-webhook] signature verification failed:", err?.message);
    return new Response(`Webhook Error: ${err?.message}`, { status: 400, headers: corsHeaders });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        // Informational only — finalize-checkout already handles success.
        const session = event.data.object as Stripe.Checkout.Session;
        await logEvent(event, { amount: (session.amount_total ?? 0) / 100 });
        break;
      }

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orders = await findOrdersByCheckoutSession(session.id);
        for (const o of orders) {
          await notify(
            o.buyer_id,
            "payment_failed",
            "Payment failed",
            "💳 Your payment didn't go through. Please try again or contact support.",
            o.id,
          );
        }
        await logEvent(event, {
          order_id: orders[0]?.id ?? null,
          buyer_id: orders[0]?.buyer_id ?? null,
          seller_id: orders[0]?.seller_id ?? null,
          amount: (session.amount_total ?? 0) / 100,
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orders = await findOrdersByPaymentIntent(pi.id);
        for (const o of orders) {
          await notify(
            o.buyer_id,
            "payment_failed",
            "Payment failed",
            `💳 ${pi.last_payment_error?.message ?? "Your card was declined."} Please try again.`,
            o.id,
          );
        }
        await logEvent(event, {
          order_id: orders[0]?.id ?? null,
          buyer_id: orders[0]?.buyer_id ?? null,
          amount: (pi.amount ?? 0) / 100,
        });
        break;
      }

      case "charge.refunded":
      case "refund.created": {
        const charge = event.data.object as Stripe.Charge | Stripe.Refund;
        const piId = (charge as Stripe.Charge).payment_intent as string ??
                     (charge as Stripe.Refund).payment_intent as string;
        let orders: Array<{ id: string; buyer_id: string; seller_id: string }> = [];
        if (piId) orders = await findOrdersByPaymentIntent(piId) as any;

        for (const o of orders) {
          await serviceClient
            .from("orders")
            .update({ refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", o.id);
          await notify(o.buyer_id, "refund_processed", "Refund processed",
            "💸 Your refund has been processed and will appear in your account shortly.", o.id);
          await notify(o.seller_id, "refund_processed_seller", "Refund issued",
            "A refund was issued for one of your sales. Tap for details.", o.id);
        }
        await logEvent(event, {
          order_id: orders[0]?.id ?? null,
          buyer_id: orders[0]?.buyer_id ?? null,
          seller_id: orders[0]?.seller_id ?? null,
          amount: ((charge as any).amount_refunded ?? (charge as any).amount ?? 0) / 100,
        });
        break;
      }

      case "charge.dispute.created":
      case "charge.dispute.funds_withdrawn": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId = dispute.payment_intent as string;
        const orders = piId ? await findOrdersByPaymentIntent(piId) : [];
        for (const o of orders) {
          await notify(o.seller_id, "dispute_opened", "⚠️ Payment disputed",
            "A buyer has disputed a payment. Please contact support immediately.", o.id);
        }
        await logEvent(event, {
          order_id: orders[0]?.id ?? null,
          buyer_id: orders[0]?.buyer_id ?? null,
          seller_id: orders[0]?.seller_id ?? null,
          amount: (dispute.amount ?? 0) / 100,
        });
        break;
      }

      case "account.updated": {
        // Sync stripe_onboarding_complete + notify seller when verification state flips.
        const acct = event.data.object as Stripe.Account;
        try {
          const { data: profile } = await serviceClient
            .from("profiles")
            .select("user_id, stripe_onboarding_complete")
            .eq("stripe_account_id", acct.id)
            .maybeSingle();
          if (profile?.user_id) {
            const fullyVerified = !!(acct.charges_enabled && acct.payouts_enabled);
            const wasVerified = !!profile.stripe_onboarding_complete;
            await serviceClient
              .from("profiles")
              .update({ stripe_onboarding_complete: fullyVerified })
              .eq("user_id", profile.user_id);
            if (fullyVerified && !wasVerified) {
              await notify(
                profile.user_id,
                "seller_verified",
                "You're verified.",
                "✅ Your seller account is fully verified. You can now receive payouts.",
              );
            } else if (!fullyVerified && acct.requirements?.disabled_reason) {
              await notify(
                profile.user_id,
                "payment_action_required",
                "Seller account needs attention.",
                "⚠️ Your payouts are paused. Open your seller dashboard to complete verification.",
              );
            }
          }
        } catch (e) {
          console.error("[stripe-webhook] account.updated handler failed", e);
        }
        await logEvent(event, {});
        break;
      }

      default:
        // Log everything for audit, but don't act
        await logEvent(event, {});
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[stripe-webhook] handler error:", error);
    // Return 200 anyway so Stripe doesn't retry forever — we've already logged.
    return new Response(JSON.stringify({ received: true, error: error?.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
