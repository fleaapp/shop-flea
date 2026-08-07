import { rejectUntrustedOrigin } from "../_shared/cors.ts";
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

async function markOnboardingComplete(userId: string, accountId: string) {
  const externalUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const response = await fetch(`${externalUrl}/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      stripe_account_id: accountId,
      stripe_onboarding_complete: true,
      stripe_onboarding_step: "complete",
    }),
  });
  const responseError = !response.ok ? await response.clone().json().catch(() => null) : null;
  if (!response.ok && (responseError?.code === "42703" || responseError?.code === "PGRST204" || String(responseError?.message ?? "").includes("stripe_onboarding_step"))) {
    await fetch(`${externalUrl}/rest/v1/profiles?user_id=eq.${userId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        stripe_account_id: accountId,
        stripe_onboarding_complete: true,
      }),
    });
  }
}

async function markOnboardingSubmitted(userId: string, accountId: string) {
  const externalUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const response = await fetch(`${externalUrl}/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      stripe_account_id: accountId,
      stripe_onboarding_complete: false,
      stripe_onboarding_step: "complete",
    }),
  });
  const responseError = !response.ok ? await response.clone().json().catch(() => null) : null;
  if (!response.ok && (responseError?.code === "42703" || responseError?.code === "PGRST204" || String(responseError?.message ?? "").includes("stripe_onboarding_step"))) {
    await fetch(`${externalUrl}/rest/v1/profiles?user_id=eq.${userId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        stripe_account_id: accountId,
        stripe_onboarding_complete: false,
      }),
    });
  }
}

// Records a bank-detail change on the seller profile. Keeps a rolling 30 day
// counter and raises the admin review flag at 3+ changes in that window.
async function recordBankChange(userId: string) {
  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: prof } = await svc
      .from("profiles")
      .select("bank_change_count_30d, bank_change_window_start, payout_review_flag")
      .eq("user_id", userId)
      .maybeSingle();

    const now = new Date();
    const windowStart = (prof as any)?.bank_change_window_start
      ? new Date((prof as any).bank_change_window_start)
      : null;
    const windowActive =
      !!windowStart && now.getTime() - windowStart.getTime() < 30 * 24 * 60 * 60 * 1000;
    const count = windowActive ? Number((prof as any)?.bank_change_count_30d ?? 0) + 1 : 1;

    const patch: Record<string, unknown> = {
      bank_status: "new",
      bank_last_changed_at: now.toISOString(),
      bank_change_count_30d: count,
      bank_change_window_start: windowActive ? windowStart!.toISOString() : now.toISOString(),
    };
    if (count >= 3) {
      patch.payout_review_flag = true;
      patch.payout_review_reason = "Bank details changed 3 or more times in 30 days";
    }
    await svc.from("profiles").update(patch).eq("user_id", userId);
  } catch (e) {
    console.warn("[stripe-connect-add-bank] recordBankChange failed:", (e as Error).message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const originBlock = rejectUntrustedOrigin(req);
  if (originBlock) return originBlock;

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { accountId, bsb, accountNumber, accountHolderName } = await req.json();
    if (!accountId || !bsb || !accountNumber) {
      return new Response(JSON.stringify({ error: "Missing bank details." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Demo/review account — no-op success.
    if (typeof accountId === "string" && accountId.startsWith("acct_demo_")) {
      await markOnboardingComplete(user.id, accountId);
      return new Response(JSON.stringify({ ok: true, demo: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const cleanBsb = String(bsb).replace(/\D/g, "");
    const cleanAcct = String(accountNumber).replace(/\D/g, "");
    if (cleanBsb.length !== 6) {
      return new Response(JSON.stringify({ error: "BSB must be 6 digits." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    if (cleanAcct.length < 5 || cleanAcct.length > 10) {
      return new Response(JSON.stringify({ error: "Account number must be 5-10 digits." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });

    // Verify ownership
    const acct = await stripe.accounts.retrieve(accountId);
    if ((acct as any).metadata?.flea_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Account not owned by user." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Accept Stripe TOS on behalf of user (required for app-controlled Express)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "0.0.0.0";
    try {
      await stripe.accounts.update(accountId, {
        tos_acceptance: {
          date: Math.floor(Date.now() / 1000),
          ip,
          service_agreement: "full",
        },
      } as any);
    } catch (e) {
      console.warn("[stripe-connect-add-bank] TOS update warn:", (e as Error).message);
    }

    // Track bank-detail churn: stamp the change and count changes in a rolling
    // 30 day window. Three or more changes flags the account for admin review.
    await recordBankChange(user.id);

    // Create bank account as external account
    await stripe.accounts.createExternalAccount(accountId, {
      external_account: {
        object: "bank_account",
        country: "AU",
        currency: "aud",
        routing_number: cleanBsb,
        account_number: cleanAcct,
        account_holder_type: "individual",
        account_holder_name: accountHolderName || undefined,
      } as any,
      default_for_currency: true,
    } as any);

    // Re-fetch to determine payout readiness
    const refreshed = await stripe.accounts.retrieve(accountId);
    const payoutsEnabled = !!refreshed.payouts_enabled;
    const chargesEnabled = !!refreshed.charges_enabled;
    const requirementsDue =
      (refreshed.requirements?.currently_due?.length ?? 0) +
      (refreshed.requirements?.past_due?.length ?? 0);

    if (payoutsEnabled && chargesEnabled) {
      await markOnboardingComplete(user.id, accountId);
    } else {
      await markOnboardingSubmitted(user.id, accountId);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        payoutsEnabled,
        chargesEnabled,
        requirementsDue,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[stripe-connect-add-bank] error:", error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to add bank details." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
