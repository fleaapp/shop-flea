import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    let accountId: string;

    if (stripeAccountId) {
      // Use existing account
      accountId = stripeAccountId;
    } else {
      // Create a new Express Connect account (simpler onboarding for individual sellers)
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        business_type: "individual",
        email: userEmail,
        business_profile: {
          mcc: "5699", // Miscellaneous apparel and accessory shops
          product_description: "Selling pre-owned clothing and accessories on Flea marketplace",
          url: "https://shop-flea.lovable.app",
        },
        metadata: {
          flea_user_id: userId,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
    }

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
