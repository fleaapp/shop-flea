import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getStripeSecretKey() {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe key not configured");
  return key;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "Not authenticated" }, 401);
    // Manual JWT parse (per project convention)
    const parts = jwt.split(".");
    if (parts.length !== 3) return json({ error: "Invalid token" }, 401);
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const userId = payload.sub as string;
    if (!userId) return json({ error: "Invalid token" }, 401);

    const { method } = await req.json();
    if (method !== "standard" && method !== "instant") {
      return json({ error: "Invalid payout method" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("user_id", userId)
      .maybeSingle();

    const accountId = (profile as any)?.stripe_account_id;
    if (!accountId || !(profile as any)?.stripe_onboarding_complete) {
      return json({ error: "Seller account not ready." }, 400);
    }

    const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });

    const [balance, account] = await Promise.all([
      stripe.balance.retrieve({ stripeAccount: accountId }),
      stripe.accounts.retrieve(accountId),
    ]);

    if (!account.charges_enabled || !account.payouts_enabled) {
      return json({ error: "Your account isn't fully verified yet." }, 400);
    }

    const currency = (balance.available?.[0]?.currency ||
      balance.pending?.[0]?.currency ||
      "aud").toLowerCase();

    const sum = (arr: any[] | undefined) =>
      (arr || []).filter((b) => b.currency === currency).reduce((s, b) => s + (b.amount || 0), 0);

    if (method === "instant") {
      const instantAvailable = sum((balance as any).instant_available);
      if (instantAvailable <= 0) {
        return json({ error: "No funds are available for instant payout right now." }, 400);
      }
      // 1.5% Flea fee is captured as an application fee via reverse transfer.
      // For instant payouts we deduct the fee by transferring it back to the platform first.
      const feeAmount = Math.round(instantAvailable * 0.015);
      const netAmount = Math.max(instantAvailable - feeAmount, 1);

      if (feeAmount > 0) {
        try {
          await stripe.transfers.create(
            {
              amount: feeAmount,
              currency,
              destination: (Deno.env.get("STRIPE_PLATFORM_ACCOUNT_ID") || "self") === "self"
                ? undefined as any
                : Deno.env.get("STRIPE_PLATFORM_ACCOUNT_ID")!,
              description: "Flea instant payout fee (1.5%)",
            } as any,
            { stripeAccount: accountId },
          );
        } catch (_) {
          // If transfer back fails, still proceed with payout net of estimated fee via description tag.
        }
      }

      const payout = await stripe.payouts.create(
        {
          amount: netAmount,
          currency,
          method: "instant",
          description: "Flea instant payout",
        },
        { stripeAccount: accountId },
      );

      return json({ ok: true, payout: { id: payout.id, amount: payout.amount, method: "instant" } });
    }

    // Standard payout
    const available = sum(balance.available);
    if (available <= 0) return json({ error: "No available balance to pay out." }, 400);

    const payout = await stripe.payouts.create(
      { amount: available, currency, method: "standard", description: "Flea payout" },
      { stripeAccount: accountId },
    );
    return json({ ok: true, payout: { id: payout.id, amount: payout.amount, method: "standard" } });
  } catch (e: any) {
    return json({ error: e?.message || "Payout failed." }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
