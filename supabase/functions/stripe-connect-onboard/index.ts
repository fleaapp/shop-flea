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

    const { returnUrl, stripeAccountId, forceNew, prefillName, prefill } = await req.json();
    const userId = user.id;

    const stripe = new Stripe(getStripeSecretKey(), {
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
      // Fetch user profile + saved address for pre-filling
      const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
      const serviceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const [profileRes, addressRes] = await Promise.all([
        fetch(`${externalUrl}/rest/v1/profiles?user_id=eq.${userId}&select=first_name,last_name,email,country_code,legal_name`, {
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
        }),
        fetch(`${externalUrl}/rest/v1/buyer_addresses?user_id=eq.${userId}&select=first_name,last_name,address,suburb,state,postcode`, {
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
        }),
      ]);
      const profiles = await profileRes.json();
      const addresses = await addressRes.json();
      const userProfile = profiles?.[0];
      const userAddress = addresses?.[0];

      const country = (userProfile?.country_code || 'AU').toUpperCase();

      const createParams: Record<string, unknown> = {
        type: "express",
        email: user.email,
        country,
        default_currency: country === 'AU' ? 'aud' : undefined,
        metadata: {
          flea_user_id: userId,
        },
        business_type: "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        // Daily automatic payouts with the minimum delay (AU minimum is 2 business days).
        // Sellers can still trigger Instant Payouts from their Express dashboard when eligible.
        settings: {
          payouts: {
            schedule: {
              interval: "daily",
              delay_days: "minimum",
            },
          },
        },
      };

      // Pre-fill individual details. `prefill` (from the in-app form) takes top priority,
      // then `prefillName`, then values stored on the profile.
      const individual: Record<string, unknown> = {};
      let prefillFirst: string | undefined;
      let prefillLast: string | undefined;
      if (typeof prefillName === 'string' && prefillName.trim().length > 0) {
        const parts = prefillName.trim().split(/\s+/);
        prefillFirst = parts[0];
        prefillLast = parts.slice(1).join(' ') || undefined;
      }
      const firstName = prefill?.firstName || prefillFirst || userProfile?.first_name || userAddress?.first_name;
      const lastName = prefill?.lastName || prefillLast || userProfile?.last_name || userAddress?.last_name;
      if (firstName) individual.first_name = firstName;
      if (lastName) individual.last_name = lastName;
      if (user.email) individual.email = user.email;

      // DOB from in-app form
      if (prefill?.dob?.year && prefill?.dob?.month && prefill?.dob?.day) {
        individual.dob = {
          year: Number(prefill.dob.year),
          month: Number(prefill.dob.month),
          day: Number(prefill.dob.day),
        };
      }

      // Phone from in-app form (E.164 preferred, but Stripe accepts national too)
      if (prefill?.phone) {
        individual.phone = String(prefill.phone);
      }

      // Personal address — prefer in-app form, fall back to saved buyer address
      if (prefill?.address?.line1) {
        const addr: Record<string, string> = {
          line1: String(prefill.address.line1),
          country: String(prefill.address.country || country),
        };
        if (prefill.address.city) addr.city = String(prefill.address.city);
        if (prefill.address.state) addr.state = String(prefill.address.state);
        if (prefill.address.postal_code) addr.postal_code = String(prefill.address.postal_code);
        individual.address = addr;
      } else if (userAddress?.address) {
        const address: Record<string, string> = {
          line1: userAddress.address,
          country,
        };
        if (userAddress.suburb) address.city = userAddress.suburb;
        if (userAddress.state) address.state = userAddress.state;
        if (userAddress.postcode) address.postal_code = userAddress.postcode;
        individual.address = address;
      }

      if (Object.keys(individual).length > 0) {
        createParams.individual = individual;
      }

      // Pre-fill business profile.
      // Setting business_profile.name = "Flea" so receipts and the Express
      // dashboard show "Flea" as the platform/brand rather than the seller's
      // legal name.
      createParams.business_profile = {
        name: "Flea",
        product_description: "Selling pre-loved fashion on Flea App. Pick 'Clothing and accessories' for industry.",
        url: "https://finditonflea.com",
        support_url: "https://finditonflea.com",
        mcc: "5699", // Miscellaneous Apparel and Accessory Shops
      };

      // NOTE: Statement descriptors are set per-charge on the Checkout Session
      // (statement_descriptor_suffix: "FLEA") so that buyers' bank statements
      // show FLEA rather than the seller's personal name.

      const account = await stripe.accounts.create(createParams as any);
      accountId = account.id;
      console.log(`[stripe-connect-onboard] Created new Express account: ${accountId}`);
    }

    // Persist stripe_account_id to DB immediately
    await persistStripeAccount(userId, accountId);

    // Ensure existing accounts also get daily payouts + Flea branding.
    try {
      await stripe.accounts.update(accountId, {
        business_profile: { name: "Flea" },
        settings: {
          payouts: { schedule: { interval: "daily", delay_days: "minimum" } },
        },
      } as any);
    } catch (e) {
      console.warn(`[stripe-connect-onboard] Account update failed for ${accountId}:`, (e as Error)?.message);
    }

    // Create an account link — Stripe handles the entire onboarding/login flow
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${returnUrl}?stripe_refresh=true`,
      return_url: `${returnUrl}?stripe_success=true`,
      type: "account_onboarding",
      collection_options: {
        fields: "currently_due",
        future_requirements: "omit",
      },
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
