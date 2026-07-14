import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getStripeSecretKey() {
  const sanitizedKey = (Deno.env.get("STRIPE_SECRET_KEY") ?? "")
    .replace(/[\s\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u3000\uFEFF]+/g, "")
    .trim();

  if (!sanitizedKey) {
    throw new Error("Stripe secret key is missing.");
  }

  return sanitizedKey;
}

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

async function clearStripeStatus(userId: string) {
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
    body: JSON.stringify({ stripe_account_id: null, stripe_onboarding_complete: false }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[stripe-connect-status] Failed to clear stale Stripe status: ${response.status} ${text}`);
  }
}

function isAppleReviewProfile(profile: any) {
  const username = String(profile?.username ?? '').toLowerCase();
  const email = String(profile?.email ?? '').toLowerCase();
  return username === '@applereview' || email === 'appreview@finditonflea.com';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Cryptographically verify JWT via Supabase auth (prevents forged tokens
    // from overwriting other users' Stripe account IDs).
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const EXTERNAL_URL = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
    const EXTERNAL_ANON_KEY = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY') ?? '';

    let userId: string;
    try {
      const verifier = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await verifier.auth.getUser(token);
      if (error || !data?.user?.id) {
        throw new Error('Invalid token');
      }
      userId = data.user.id;
    } catch {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body = await req.json();
    const { stripeAccountId, sellerUserId } = body;

    const stripe = new Stripe(getStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';

    let accountId = stripeAccountId;
    let lookupUserId = userId;
    let lookupProfile: any = null;

    // If checking a different seller (e.g. from checkout flow), fetch their profile via service role
    if (sellerUserId && sellerUserId !== userId) {
      console.log(`[stripe-connect-status] Looking up seller profile for userId: ${sellerUserId}`);
      const serviceClient = createClient(externalUrl, serviceKey);
      const { data: sellerProfile } = await serviceClient
        .from('profiles')
        .select('stripe_account_id, username, email')
        .eq('user_id', sellerUserId)
        .single();

      if (!accountId && sellerProfile?.stripe_account_id) {
        accountId = sellerProfile.stripe_account_id;
      }
      lookupProfile = sellerProfile;
      lookupUserId = sellerUserId;
    } else {
      const serviceClient = createClient(externalUrl, serviceKey);
      const { data: ownProfile } = await serviceClient
        .from('profiles')
        .select('stripe_account_id, username, email')
        .eq('user_id', lookupUserId)
        .single();
      lookupProfile = ownProfile;
      if (!accountId && ownProfile?.stripe_account_id) {
        accountId = ownProfile.stripe_account_id;
      }
    }

    // -------- DEMO BYPASS (Apple App Review) --------
    // Demo accounts use synthetic IDs like `acct_demo_*`. Never call Stripe
    // for these — return a fully-verified state so the reviewer can list/buy.
    if (accountId && accountId.startsWith('acct_demo_')) {
      if (!isAppleReviewProfile(lookupProfile)) {
        console.warn(`[stripe-connect-status] Clearing non-review synthetic account ${accountId} for user ${lookupUserId}`);
        await clearStripeStatus(lookupUserId);
        return new Response(
          JSON.stringify({ chargesEnabled: false, detailsSubmitted: false, payoutsEnabled: false, accountId: null, accountExists: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      await persistStripeStatus(lookupUserId, accountId);
      return new Response(
        JSON.stringify({
          chargesEnabled: true,
          detailsSubmitted: true,
          payoutsEnabled: true,
          accountId,
          accountExists: true,
          requirementsDisabledReason: null,
          demo: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
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

    const currentlyDue = account.requirements?.currently_due ?? [];
    const pastDue = account.requirements?.past_due ?? [];
    const errors = (account.requirements?.errors ?? []) as Array<{
      code?: string;
      reason?: string;
      requirement?: string;
    }>;
    const needsIdDocument =
      [...currentlyDue, ...pastDue].some((r) =>
        r?.startsWith('individual.verification.document') ||
        r?.startsWith('individual.verification.additional_document')
      );

    // Surface the specific verification failure so the client can explain why
    // and route to the right fix (re-upload vs edit name).
    const docError = errors.find((e) =>
      (e.requirement || '').startsWith('individual.verification') ||
      (e.code || '').startsWith('verification_document_')
    ) || errors[0] || null;
    const nameMismatch = !!docError && /name/i.test(docError.code || '');

    return new Response(
      JSON.stringify({
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
        payoutsEnabled: account.payouts_enabled,
        accountId: accountId,
        accountExists: true,
        requirementsDisabledReason: account.requirements?.disabled_reason || null,
        currentlyDue,
        pastDue,
        needsIdDocument,
        verificationError: docError
          ? {
              code: docError.code || null,
              reason: docError.reason || null,
              requirement: docError.requirement || null,
              nameMismatch,
            }
          : null,
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
