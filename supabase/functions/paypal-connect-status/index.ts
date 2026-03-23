import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYPAL_API = "https://api-m.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_SECRET_KEY");
  if (!clientId || !secret) throw new Error("PayPal credentials not configured");

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function persistPayPalStatus(userId: string, merchantId: string) {
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
      body: JSON.stringify({
        paypal_merchant_id: merchantId,
        paypal_onboarding_complete: true,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`[paypal-status] Failed to persist status: ${response.status} ${text}`);
  } else {
    console.log(`[paypal-status] Persisted paypal_merchant_id=${merchantId}, paypal_onboarding_complete=true for user ${userId}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body = await req.json();
    const { sellerUserId } = body;

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const lookupUserId = sellerUserId || user.id;

    // Get the merchant ID from profiles
    const serviceClient = createClient(externalUrl, serviceKey);
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("paypal_merchant_id, paypal_onboarding_complete")
      .eq("user_id", lookupUserId)
      .single();

    if (profile?.paypal_onboarding_complete && profile?.paypal_merchant_id) {
      return new Response(
        JSON.stringify({
          connected: true,
          merchantId: profile.paypal_merchant_id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Check with PayPal API using the tracking_id (user ID)
    const accessToken = await getPayPalAccessToken();
    const partnerId = Deno.env.get("PAYPAL_CLIENT_ID");

    // Get merchant status via partner referral tracking ID
    const statusRes = await fetch(
      `${PAYPAL_API}/v1/customer/partners/${partnerId}/merchant-integrations?tracking_id=${lookupUserId}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      console.log(`[paypal-status] Merchant integration lookup failed: ${statusRes.status} ${errText}`);
      return new Response(
        JSON.stringify({ connected: false, merchantId: null }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const statusData = await statusRes.json();
    const merchantIntegration = statusData.merchant_id ? statusData : null;

    if (merchantIntegration?.merchant_id) {
      const merchantId = merchantIntegration.merchant_id;
      const paymentsReceivable = merchantIntegration.payments_receivable ?? false;

      if (paymentsReceivable) {
        await persistPayPalStatus(lookupUserId, merchantId);
      }

      return new Response(
        JSON.stringify({
          connected: paymentsReceivable,
          merchantId,
          paymentsReceivable,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ connected: false, merchantId: null }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("PayPal Connect status error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
