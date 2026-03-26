import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function persistStripeAccount(userId: string, accountId: string) {
  const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const response = await fetch(`${externalUrl}/rest/v1/profiles?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ stripe_account_id: accountId }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[stripe-connect-onboard] Failed to persist stripe_account_id: ${response.status} ${text}`);
  } else {
    console.log(`[stripe-connect-onboard] Persisted stripe_account_id=${accountId} for user ${userId}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate against the external Supabase project
    const supabaseClient = createClient(
      Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '',
      Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { returnUrl, stripeAccountId, forceNew } = await req.json();
    const userId = user.id;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let accountId = forceNew ? null : (stripeAccountId || null);

    // Check if existing account is reusable
    if (accountId) {
      try {
        const existing = await stripe.accounts.retrieve(accountId);
        if (existing.deleted) {
          console.warn(`[stripe-connect-onboard] Account ${accountId} is deleted, creating new`);
          accountId = null;
        } else if (existing.metadata?.flea_user_id !== userId) {
          console.warn(`[stripe-connect-onboard] Account ${accountId} not owned by user ${userId}`);
          accountId = null;
        }
      } catch {
        accountId = null;
      }
    }

    // Create a new Standard account if needed
    if (!accountId) {
      // Fetch user profile for pre-filling
      const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
      const serviceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const profileRes = await fetch(`${externalUrl}/rest/v1/profiles?user_id=eq.${userId}&select=first_name,last_name,email,country_code`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
      });
      const profiles = await profileRes.json();
      const userProfile = profiles?.[0];

      const createParams: Record<string, unknown> = {
        type: "standard",
        email: user.email,
        metadata: {
          flea_user_id: userId,
        },
        business_type: "individual",
      };

      // Pre-fill individual details
      const individual: Record<string, unknown> = {};
      if (userProfile?.first_name) individual.first_name = userProfile.first_name;
      if (userProfile?.last_name) individual.last_name = userProfile.last_name;
      if (user.email) individual.email = user.email;
      if (Object.keys(individual).length > 0) {
        createParams.individual = individual;
      }

      // Pre-fill country
      if (userProfile?.country_code) {
        createParams.country = userProfile.country_code.toUpperCase();
      }

      // Pre-fill business profile
      createParams.business_profile = {
        name: userProfile?.first_name && userProfile?.last_name
          ? `${userProfile.first_name} ${userProfile.last_name}`
          : undefined,
        product_description: "Selling pre-loved fashion on Flea marketplace",
      };

      const account = await stripe.accounts.create(createParams as any);
      accountId = account.id;
      console.log(`[stripe-connect-onboard] Created new Standard account: ${accountId}`);
    }

    // Persist stripe_account_id to DB immediately
    await persistStripeAccount(userId, accountId);

    // Create an account link — Stripe handles the entire onboarding/login flow
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${returnUrl}?stripe_refresh=true`,
      return_url: `${returnUrl}?stripe_success=true`,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({
        url: accountLink.url,
        accountId: accountId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Stripe Connect onboard error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
