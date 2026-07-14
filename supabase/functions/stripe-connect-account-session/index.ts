import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getStripeSecretKey() {
  const key = (Deno.env.get("STRIPE_SECRET_KEY") ?? "")
    .replace(/[\s\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u3000\uFEFF]+/g, "")
    .trim();
  if (!key) throw new Error("Stripe secret key is missing.");
  return key;
}

function isAppleReviewProfile(profile: any) {
  const username = String(profile?.username ?? '').toLowerCase();
  const email = String(profile?.email ?? '').toLowerCase();
  return username === '@applereview' || email === 'appreview@finditonflea.com';
}

async function clearStripeStatus(externalUrl: string, serviceKey: string, userId: string) {
  await fetch(`${externalUrl}/rest/v1/profiles?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ stripe_account_id: null, stripe_onboarding_complete: false }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const EXTERNAL_ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
    const SERVICE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const verifier = createClient(EXTERNAL_URL, EXTERNAL_ANON, {
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

    // Look up seller's Stripe account
    const profileRes = await fetch(
      `${EXTERNAL_URL}/rest/v1/profiles?user_id=eq.${userId}&select=stripe_account_id,username,email`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const profiles = await profileRes.json();
    const profile = profiles?.[0] ?? null;
    const accountId: string | null = profile?.stripe_account_id ?? null;

    if (!accountId) {
      return new Response(JSON.stringify({ error: "No connected account" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (accountId.startsWith('acct_demo_')) {
      if (isAppleReviewProfile(profile)) {
        return new Response(JSON.stringify({ demo: true, accountId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      await clearStripeStatus(EXTERNAL_URL, SERVICE_KEY, userId);
      return new Response(JSON.stringify({ error: "Seller setup needs to be completed again" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });

    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true, features: { external_account_collection: true } },
        payments: {
          enabled: true,
          features: { refund_management: true, dispute_management: true, capture_payments: true },
        },
        payouts: {
          enabled: true,
          features: {
            instant_payouts: true,
            standard_payouts: true,
            edit_payout_schedule: false,
            external_account_collection: true,
          },
        },
        balances: { enabled: true, features: { instant_payouts: true, standard_payouts: true, edit_payout_schedule: false } },
        notification_banner: { enabled: true, features: { external_account_collection: true } },
      } as any,
    });

    const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "";

    return new Response(
      JSON.stringify({
        clientSecret: accountSession.client_secret,
        publishableKey,
        accountId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("[stripe-connect-account-session] error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
