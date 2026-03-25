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

  // Use raw REST PATCH directly — avoids any PostgREST schema cache issues
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

async function getReusableStripeAccountId(
  stripe: Stripe,
  candidateAccountId: string | undefined,
  userId: string,
) {
  if (!candidateAccountId) {
    return null;
  }

  try {
    const account = await stripe.accounts.retrieve(candidateAccountId);

    if (account.deleted) {
      console.warn(`[stripe-connect-onboard] Ignoring deleted account ${candidateAccountId} for user ${userId}`);
      return null;
    }

    const isOwnedByUser = account.metadata?.flea_user_id === userId;
    const isIndividual = account.business_type === "individual";
    const isOnboardingComplete = account.details_submitted === true;

    if (!isOwnedByUser) {
      console.warn(`[stripe-connect-onboard] Ignoring account ${candidateAccountId} because it is not owned by user ${userId}`);
      return null;
    }

    if (!isIndividual) {
      console.warn(`[stripe-connect-onboard] Ignoring account ${candidateAccountId} because business_type=${account.business_type ?? 'unknown'}`);
      return null;
    }

    // Only reuse accounts that have completed onboarding.
    // If the user abandoned onboarding midway, create a fresh account
    // so they start from the beginning.
    if (!isOnboardingComplete) {
      console.warn(`[stripe-connect-onboard] Ignoring incomplete account ${candidateAccountId} for user ${userId} — will create fresh`);
      return null;
    }

    return account.id;
  } catch (error) {
    console.error(`[stripe-connect-onboard] Failed to inspect account ${candidateAccountId}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate against the external Supabase project where users sign in
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

    const { returnUrl, stripeAccountId } = await req.json();
    const userEmail = user.email;
    const userId = user.id;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let accountId = await getReusableStripeAccountId(stripe, stripeAccountId, userId);

    if (accountId) {
      console.log(`[stripe-connect-onboard] Reusing verified individual account: ${accountId}`);
    } else {
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        business_type: "individual",
        email: userEmail,
        metadata: {
          flea_user_id: userId,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      console.log(`[stripe-connect-onboard] Created new individual account: ${accountId}`);
    }

    // Persist stripe_account_id to DB immediately server-side
    await persistStripeAccount(userId, accountId);

    // Create an account link for onboarding
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
