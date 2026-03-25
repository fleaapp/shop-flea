import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function persistStripeAccount(userId: string, accountId: string) {
  const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const response = await fetch(
    `${externalUrl}/rest/v1/profiles?user_id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ stripe_account_id: accountId }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(
      `[stripe-custom-onboard] Failed to persist stripe_account_id: ${response.status} ${text}`
    );
  } else {
    console.log(
      `[stripe-custom-onboard] Persisted stripe_account_id=${accountId} for user ${userId}`
    );
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate
    const supabaseClient = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const {
      firstName,
      lastName,
      dobDay,
      dobMonth,
      dobYear,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      bsb,
      accountNumber,
      returnUrl,
      existingAccountId,
    } = await req.json();

    const userId = user.id;
    const userEmail = user.email;

    // Get client IP for ToS acceptance
    const userIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if existing account is reusable (must be Custom, owned by user, not deleted)
    let accountId: string | null = existingAccountId || null;
    if (accountId) {
      try {
        const existing = await stripe.accounts.retrieve(accountId);
        const isReusable =
          !existing.deleted &&
          existing.metadata?.flea_user_id === userId &&
          existing.type === "custom";
        if (!isReusable) {
          console.log(
            `[stripe-custom-onboard] Existing account ${accountId} not reusable (type=${existing.type}, deleted=${existing.deleted}), creating new`
          );
          accountId = null;
        }
      } catch {
        console.log(
          `[stripe-custom-onboard] Could not retrieve account ${accountId}, creating new`
        );
        accountId = null;
      }
    }

    const cleanBsb = bsb.replace(/[^0-9]/g, "");
    const cleanAccountNumber = accountNumber.replace(/[^0-9]/g, "");

    const individualData = {
      first_name: firstName,
      last_name: lastName,
      email: userEmail,
      dob: {
        day: parseInt(dobDay),
        month: parseInt(dobMonth),
        year: parseInt(dobYear),
      },
      address: {
        line1: addressLine1,
        line2: addressLine2 || undefined,
        city: city,
        state: state,
        postal_code: postalCode,
        country: "AU",
      },
    };

    const businessProfile = {
      product_description:
        "Selling pre-loved fashion on Flea marketplace",
      url: "https://shop-flea.lovable.app",
    };

    const tosAcceptance = {
      date: Math.floor(Date.now() / 1000),
      ip: userIp,
    };

    if (accountId) {
      // Update existing Custom account
      await stripe.accounts.update(accountId, {
        business_type: "individual",
        individual: individualData,
        business_profile: businessProfile,
        tos_acceptance: tosAcceptance,
      });

      // Replace bank account
      try {
        await stripe.accounts.createExternalAccount(accountId, {
          external_account: {
            object: "bank_account",
            country: "AU",
            currency: "aud",
            routing_number: cleanBsb,
            account_number: cleanAccountNumber,
          } as any,
        });
      } catch (e) {
        console.warn(
          `[stripe-custom-onboard] Bank account update: ${e.message}`
        );
      }

      console.log(
        `[stripe-custom-onboard] Updated existing custom account: ${accountId}`
      );
    } else {
      // Create new Custom account
      const account = await stripe.accounts.create({
        type: "custom",
        country: "AU",
        business_type: "individual",
        individual: individualData,
        business_profile: businessProfile,
        tos_acceptance: tosAcceptance,
        external_account: {
          object: "bank_account",
          country: "AU",
          currency: "aud",
          routing_number: cleanBsb,
          account_number: cleanAccountNumber,
        } as any,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          flea_user_id: userId,
        },
      });
      accountId = account.id;
      console.log(
        `[stripe-custom-onboard] Created new custom account: ${accountId}`
      );
    }

    // Persist account ID to DB
    await persistStripeAccount(userId, accountId);

    // Retrieve account to check remaining requirements
    const account = await stripe.accounts.retrieve(accountId);
    const currentlyDue = account.requirements?.currently_due || [];
    const eventuallyDue = account.requirements?.eventually_due || [];
    const hasRemainingRequirements =
      currentlyDue.length > 0 || eventuallyDue.length > 0;

    let verificationUrl: string | null = null;

    if (hasRemainingRequirements) {
      // Create Account Link for remaining requirements (likely ID verification)
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${returnUrl}?stripe_refresh=true`,
        return_url: `${returnUrl}?stripe_success=true`,
        type: "account_onboarding",
      });
      verificationUrl = accountLink.url;
      console.log(
        `[stripe-custom-onboard] Remaining requirements: ${JSON.stringify(currentlyDue)}`
      );
    } else {
      console.log(
        `[stripe-custom-onboard] No remaining requirements — account fully set up`
      );
    }

    return new Response(
      JSON.stringify({
        accountId,
        verificationUrl,
        requirementsComplete: !hasRemainingRequirements,
        currentlyDue,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Stripe Custom onboard error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});