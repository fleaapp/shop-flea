import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Flea charges a 1.5% instant payout fee (on top of Stripe's own instant fee,
// which is deducted from the payout by Stripe automatically). We charge
// application-side by trimming the payout amount so the connected account
// keeps the remainder on their balance, and we transfer the fee out.
const INSTANT_PAYOUT_FEE_RATE = 0.015;

function getStripeSecretKey() {
  const k = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
  if (!k) throw new Error("Stripe secret key missing");
  return k;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
    const ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
    const SERVICE = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const verifier = createClient(EXTERNAL_URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authErr } = await verifier.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const userId = authData.user.id;

    const body = await req.json().catch(() => ({}));
    const method: "standard" | "instant" = body?.method === "instant" ? "instant" : "standard";

    const svc = createClient(EXTERNAL_URL, SERVICE);
    const { data: profile } = await svc
      .from("profiles")
      .select("stripe_account_id")
      .eq("user_id", userId)
      .single();

    const accountId = profile?.stripe_account_id;
    if (!accountId) {
      return new Response(JSON.stringify({ error: "No connected account" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });

    const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
    const currency = (balance.available?.[0]?.currency || "aud").toLowerCase();

    const available = (method === "instant"
      ? ((balance as any).instant_available as any[] | undefined)
      : balance.available
    )?.filter((b: any) => b.currency === currency).reduce((s: number, b: any) => s + (b.amount || 0), 0) || 0;

    if (available <= 0) {
      return new Response(
        JSON.stringify({ error: method === "instant" ? "No instant balance available." : "No available balance." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    let payoutAmount = available;
    let fleaFeeCents = 0;

    if (method === "instant") {
      fleaFeeCents = Math.round(available * INSTANT_PAYOUT_FEE_RATE);
      payoutAmount = available - fleaFeeCents;
      if (payoutAmount <= 0) {
        return new Response(
          JSON.stringify({ error: "Amount too small for instant payout." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    const idempotencyKey = `flea-payout-${accountId}-${method}-${Math.floor(Date.now() / 60000)}`;

    const payout = await stripe.payouts.create(
      {
        amount: payoutAmount,
        currency,
        method: method === "instant" ? "instant" : "standard",
        metadata: {
          flea_user_id: userId,
          flea_instant_fee_cents: fleaFeeCents.toString(),
        },
      },
      { stripeAccount: accountId, idempotencyKey }
    );

    // Collect Flea's 1.5% instant payout fee as an application fee via transfer_reversal? Simpler:
    // Create a transfer from the connected account to the platform for the fee amount.
    if (fleaFeeCents > 0) {
      try {
        await stripe.transfers.create(
          {
            amount: fleaFeeCents,
            currency,
            destination: (await stripe.accounts.retrieve()).id,
            description: "Flea instant payout fee (1.5%)",
            metadata: { flea_user_id: userId, source_payout: payout.id },
          },
          { stripeAccount: accountId, idempotencyKey: `${idempotencyKey}-fee` }
        );
      } catch (e) {
        console.warn("[stripe-connect-payout] Fee transfer failed (non-blocking):", (e as any)?.message);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        payoutId: payout.id,
        amount: payoutAmount,
        currency,
        method,
        arrivalDate: payout.arrival_date,
        instantFeeCents: fleaFeeCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    console.error("[stripe-connect-payout]", e);
    return new Response(JSON.stringify({ error: e?.message || "Payout failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
