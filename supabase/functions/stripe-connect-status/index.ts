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

    const body = await req.json();
    const { stripeAccountId } = body;
    const userEmail = user.email;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let accountId = stripeAccountId;

    // If no account ID provided, search by email in connected accounts
    if (!accountId && userEmail) {
      console.log(`[stripe-connect-status] Searching for account by email: ${userEmail}`);
      const accounts = await stripe.accounts.list({ limit: 100 });
      // Find the BEST match: prefer one with details_submitted, then charges_enabled, then any match
      const matches = accounts.data.filter(
        (a) => a.email?.toLowerCase() === userEmail.toLowerCase()
      );
      if (matches.length > 0) {
        // Prefer the most "complete" account
        const best = matches.find(a => a.charges_enabled) 
          || matches.find(a => a.details_submitted)
          || matches[0];
        accountId = best.id;
        console.log(`[stripe-connect-status] Found ${matches.length} account(s), using best: ${accountId}`);
      } else {
        console.log(`[stripe-connect-status] No account found for email: ${userEmail}`);
      }
    }

    if (!accountId) {
      return new Response(
        JSON.stringify({ chargesEnabled: false, detailsSubmitted: false, accountId: null, accountExists: false }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const account = await stripe.accounts.retrieve(accountId);

    console.log(`[stripe-connect-status] Account ${accountId} state: charges_enabled=${account.charges_enabled}, details_submitted=${account.details_submitted}, payouts_enabled=${account.payouts_enabled}, disabled_reason=${account.requirements?.disabled_reason}`);

    return new Response(
      JSON.stringify({
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
        payoutsEnabled: account.payouts_enabled,
        accountId: accountId,
        accountExists: true,
        requirementsDisabledReason: account.requirements?.disabled_reason || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Stripe Connect status error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
