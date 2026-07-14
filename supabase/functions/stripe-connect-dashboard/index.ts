import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getStripeSecretKey() {
  const k = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
  if (!k) throw new Error("Stripe secret key missing");
  return k;
}

function isAppleReviewProfile(p: any) {
  const u = String(p?.username ?? "").toLowerCase();
  const e = String(p?.email ?? "").toLowerCase();
  return u === "@applereview" || e === "appreview@finditonflea.com";
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

    const svc = createClient(EXTERNAL_URL, SERVICE);
    const { data: profile } = await svc
      .from("profiles")
      .select("stripe_account_id, username, email, stripe_onboarding_complete")
      .eq("user_id", userId)
      .single();

    const accountId = profile?.stripe_account_id ?? null;

    if (!accountId) {
      return new Response(
        JSON.stringify({ connected: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Demo / Apple review bypass — return dummy but well-formed data
    if (accountId.startsWith("acct_demo_") && isAppleReviewProfile(profile)) {
      return new Response(
        JSON.stringify({
          connected: true,
          demo: true,
          currency: "aud",
          available: 0,
          pending: 0,
          instantAvailable: 0,
          payouts: [],
          nextPayout: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });

    const [balance, payouts, account, charges] = await Promise.all([
      stripe.balance.retrieve({ stripeAccount: accountId }),
      stripe.payouts.list({ limit: 10 }, { stripeAccount: accountId }),
      stripe.accounts.retrieve(accountId),
      stripe.charges.list({ limit: 1 }, { stripeAccount: accountId }).catch(() => ({ data: [] as any[] })),
    ]);

    const currency = (balance.available?.[0]?.currency || balance.pending?.[0]?.currency || "aud").toLowerCase();
    const sum = (arr: any[] | undefined, cur: string) =>
      (arr || []).filter((b) => b.currency === cur).reduce((s, b) => s + (b.amount || 0), 0);

    const available = sum(balance.available, currency);
    const pending = sum(balance.pending, currency);
    const instantAvailable = sum((balance as any).instant_available, currency);

    const nextPayout = payouts.data.find((p) => p.status === "pending" || p.status === "in_transit") ?? null;

    const chargesEnabled = !!account.charges_enabled;
    const payoutsEnabled = !!account.payouts_enabled;
    const hasSucceededCharge = (charges as any).data?.some?.((c: any) => c.status === "succeeded") ?? false;
    const capabilities: any = account.capabilities || {};
    const instantPayoutEligible = capabilities.instant_payouts === "active";

    return new Response(
      JSON.stringify({
        connected: true,
        currency,
        available,
        pending,
        instantAvailable,
        chargesEnabled,
        payoutsEnabled,
        hasSucceededCharge,
        instantPayoutEligible,
        nextPayout: nextPayout
          ? {
              amount: nextPayout.amount,
              arrivalDate: nextPayout.arrival_date,
              status: nextPayout.status,
            }
          : null,
        payouts: payouts.data.map((p) => ({
          id: p.id,
          amount: p.amount,
          status: p.status,
          arrivalDate: p.arrival_date,
          created: p.created,
          method: p.method,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    console.error("[stripe-connect-dashboard]", e);
    return new Response(JSON.stringify({ error: e.message || "Error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
