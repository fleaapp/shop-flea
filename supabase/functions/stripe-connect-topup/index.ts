// stripe-connect-topup
// Lets a seller with a negative Stripe Connect balance settle it from within
// the app by charging a card/wallet directly on their connected account. Funds
// land in their Connect balance and offset the negative amount.

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
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const verifier = createClient(externalUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: u, error: uErr } = await verifier.auth.getUser(token);
    if (uErr || !u?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const amountCents = Number(body.amountCents ?? 0);
    if (!Number.isFinite(amountCents) || amountCents < 100) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(externalUrl, serviceKey);
    const { data: profile } = await svc
      .from("profiles")
      .select("stripe_account_id, negative_balance_cents")
      .eq("user_id", userId)
      .maybeSingle();

    const accountId = profile?.stripe_account_id;
    if (!accountId) {
      return new Response(JSON.stringify({ error: "No connected account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2025-08-27.basil",
    });

    // Create a PaymentIntent ON the connected account. Funds go directly to
    // their Connect balance and offset the negative amount.
    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "aud",
        automatic_payment_methods: { enabled: true },
        description: "Flea seller balance settlement",
        metadata: {
          flea_user_id: userId,
          flea_purpose: "settle_negative_balance",
        },
      },
      {
        stripeAccount: accountId,
        idempotencyKey: `flea-topup-${userId}-${amountCents}-${Math.floor(Date.now() / 60000)}`,
      },
    );

    // Fetch the recent refunds/disputes that pushed the balance negative so we
    // can show the seller a breakdown of what they owe on.
    const breakdown: Array<{ id: string; type: string; amountCents: number; createdAt: string; description: string | null }> = [];
    try {
      const { data: events } = await svc
        .from("payment_events")
        .select("event_id, event_type, amount, created_at, order_id")
        .eq("seller_id", userId)
        .in("event_type", [
          "charge.refunded",
          "refund.created",
          "charge.dispute.created",
          "charge.dispute.funds_withdrawn",
        ])
        .order("created_at", { ascending: false })
        .limit(10);

      const orderIds = (events ?? []).map((e: any) => e.order_id).filter(Boolean);
      const orderMap = new Map<string, string>();
      if (orderIds.length > 0) {
        const { data: orders } = await svc
          .from("orders")
          .select("id, order_number")
          .in("id", orderIds);
        for (const o of orders ?? []) orderMap.set(o.id, o.order_number);
      }

      for (const e of events ?? []) {
        const label = e.event_type.includes("dispute") ? "Dispute" : "Refund";
        const ordRef = e.order_id ? orderMap.get(e.order_id) : null;
        breakdown.push({
          id: e.event_id,
          type: label,
          amountCents: Math.round(Number(e.amount ?? 0) * 100),
          createdAt: e.created_at,
          description: ordRef ? `${label} on ${ordRef}` : label,
        });
      }
    } catch (e) {
      console.warn("[stripe-connect-topup] breakdown fetch failed", e);
    }

    return new Response(
      JSON.stringify({
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        connectedAccountId: accountId,
        breakdown,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[stripe-connect-topup] error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Top-up failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
