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

  // Use raw REST PATCH directly — avoids any PostgREST schema cache issues
  const response = await fetch(`${externalUrl}/rest/v1/profiles?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ stripe_account_id: accountId, stripe_onboarding_complete: true }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[stripe-connect-status] Failed to persist Stripe status: ${response.status} ${text}`);
  } else {
    console.log(`[stripe-connect-status] Persisted stripe_account_id=${accountId}, stripe_onboarding_complete=true for user ${userId}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Manual JWT parsing – more reliable in cross-project environments
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    let userId: string;
    try {
      const payloadB64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadB64));
      if (!payload.sub || (payload.exp && payload.exp * 1000 < Date.now())) {
        throw new Error('Invalid or expired token');
      }
      userId = payload.sub;
    } catch {
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
    let lookupUserId = userId;

    // If checking a different seller (e.g. from checkout flow), fetch their profile via service role
    if (sellerUserId && sellerUserId !== user.id) {
      console.log(`[stripe-connect-status] Looking up seller profile for userId: ${sellerUserId}`);
      const serviceClient = createClient(externalUrl, serviceKey);
      const { data: sellerProfile } = await serviceClient
        .from('profiles')
        .select('stripe_account_id')
        .eq('user_id', sellerUserId)
        .single();

      if (!accountId && sellerProfile?.stripe_account_id) {
        accountId = sellerProfile.stripe_account_id;
      }
      lookupUserId = sellerUserId;
    }

    if (!accountId) {
      console.log(`[stripe-connect-status] No stored Stripe account for user ${lookupUserId}; skipping email lookup.`);
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

    // Only persist stripe_onboarding_complete when fully verified (charges + payouts enabled)
    if (account.charges_enabled && account.payouts_enabled) {
      await persistStripeStatus(lookupUserId, accountId);

      // Set statement descriptors AFTER onboarding so they don't override the user's name
      try {
        const currentDescriptor = account.settings?.payments?.statement_descriptor;
        if (!currentDescriptor || currentDescriptor !== 'FINDITONFLEA.COM') {
          await stripe.accounts.update(accountId, {
            settings: {
              payments: { statement_descriptor: 'FINDITONFLEA.COM' },
              card_payments: { statement_descriptor_prefix: 'FLEA' },
            },
          });
          console.log(`[stripe-connect-status] Set statement descriptors for account ${accountId}`);
        }
      } catch (descErr) {
        console.warn(`[stripe-connect-status] Failed to set descriptors: ${descErr.message}`);
      }
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
