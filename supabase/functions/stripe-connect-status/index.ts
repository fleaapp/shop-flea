import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

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
    const body = await req.json();
    const { stripeAccountId, userEmail } = body;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let accountId = stripeAccountId;

    // If no account ID provided, search by email in connected accounts
    if (!accountId && userEmail) {
      console.log(`[stripe-connect-status] Searching for account by email: ${userEmail}`);
      const accounts = await stripe.accounts.list({ limit: 100 });
      const match = accounts.data.find(
        (a) => a.email?.toLowerCase() === userEmail.toLowerCase()
      );
      if (match) {
        accountId = match.id;
        console.log(`[stripe-connect-status] Found account: ${accountId}`);
      } else {
        console.log(`[stripe-connect-status] No account found for email: ${userEmail}`);
      }
    }

    if (!accountId) {
      return new Response(
        JSON.stringify({ chargesEnabled: false, detailsSubmitted: false, accountId: null }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const account = await stripe.accounts.retrieve(accountId);

    return new Response(
      JSON.stringify({
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
        payoutsEnabled: account.payouts_enabled,
        accountId: accountId,
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
