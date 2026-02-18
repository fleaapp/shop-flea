import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function persistStripeStatus(userId: string, accountId: string) {
  const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Use service-role client for DB writes (bypasses RLS)
  const serviceClient = createClient(externalUrl, serviceKey);

  const { error } = await serviceClient
    .from('profiles')
    .update({ stripe_account_id: accountId, stripe_onboarding_complete: true })
    .eq('user_id', userId);

  if (error) {
    console.error(`[stripe-connect-status] Failed to persist via SDK: ${error.message} (${error.code})`);

    // If PGRST204 schema cache issue, fall back to raw REST with schema-reload header
    if (error.code === 'PGRST204') {
      console.log(`[stripe-connect-status] Attempting raw REST fallback for PGRST204...`);
      const response = await fetch(`${externalUrl}/rest/v1/profiles?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
          'Accept-Profile': 'public',
        },
        body: JSON.stringify({ stripe_account_id: accountId, stripe_onboarding_complete: true }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error(`[stripe-connect-status] Raw REST fallback failed: ${response.status} ${text}`);
      } else {
        console.log(`[stripe-connect-status] Raw REST fallback succeeded for user ${userId}`);
      }
    }
  } else {
    console.log(`[stripe-connect-status] Persisted stripe_account_id=${accountId}, stripe_onboarding_complete=true for user ${userId}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { stripeAccountId, sellerUserId } = body;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';

    let accountId = stripeAccountId;
    let lookupUserId = user.id;
    let lookupEmail = user.email;

    // If checking a different seller (e.g. from checkout flow), fetch their profile via service role
    if (sellerUserId && sellerUserId !== user.id) {
      console.log(`[stripe-connect-status] Looking up seller profile for userId: ${sellerUserId}`);
      const serviceClient = createClient(externalUrl, serviceKey);
      const { data: sellerProfile } = await serviceClient
        .from('profiles')
        .select('email, stripe_account_id')
        .eq('user_id', sellerUserId)
        .single();

      if (sellerProfile?.email) {
        lookupEmail = sellerProfile.email;
        console.log(`[stripe-connect-status] Found seller email: ${lookupEmail}`);
      }
      if (!accountId && sellerProfile?.stripe_account_id) {
        accountId = sellerProfile.stripe_account_id;
      }
      lookupUserId = sellerUserId;
    }

    // If no account ID provided, search by email in connected accounts
    if (!accountId && lookupEmail) {
      console.log(`[stripe-connect-status] Searching for account by email: ${lookupEmail}`);
      const accounts = await stripe.accounts.list({ limit: 100 });
      const matches = accounts.data.filter(
        (a) => a.email?.toLowerCase() === lookupEmail!.toLowerCase()
      );
      if (matches.length > 0) {
        const best = matches.find(a => a.charges_enabled)
          || matches.find(a => a.details_submitted)
          || matches[0];
        accountId = best.id;
        console.log(`[stripe-connect-status] Found ${matches.length} account(s), using best: ${accountId}`);
      } else {
        console.log(`[stripe-connect-status] No account found for email: ${lookupEmail}`);
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

    console.log(`[stripe-connect-status] Account ${accountId} state: charges_enabled=${account.charges_enabled}, details_submitted=${account.details_submitted}, payouts_enabled=${account.payouts_enabled}`);

    if (account.charges_enabled || account.details_submitted) {
      await persistStripeStatus(lookupUserId, accountId);
    }

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
