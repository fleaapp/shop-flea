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

async function persistPayPalMerchant(userId: string, merchantId: string) {
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
      body: JSON.stringify({ paypal_merchant_id: merchantId }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`[paypal-onboard] Failed to persist merchant ID: ${response.status} ${text}`);
  } else {
    console.log(`[paypal-onboard] Persisted paypal_merchant_id=${merchantId} for user ${userId}`);
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
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { returnUrl } = await req.json();
    const accessToken = await getPayPalAccessToken();

    // Create partner referral
    const referralRes = await fetch(`${PAYPAL_API}/v2/customer/partner-referrals`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tracking_id: user.id,
        operations: [
          {
            operation: "API_INTEGRATION",
            api_integration_preference: {
              rest_api_integration: {
                integration_method: "PAYPAL",
                integration_type: "THIRD_PARTY",
                third_party_details: {
                  features: ["PAYMENT", "REFUND"],
                },
              },
            },
          },
        ],
        products: ["EXPRESS_CHECKOUT"],
        legal_consents: [
          {
            type: "SHARE_DATA_CONSENT",
            granted: true,
          },
        ],
        partner_config_override: {
          return_url: `${returnUrl}?paypal_success=true`,
          return_url_description: "Return to Flea after connecting PayPal",
        },
      }),
    });

    if (!referralRes.ok) {
      const errText = await referralRes.text();
      console.error(`[paypal-onboard] Partner referral failed: ${referralRes.status} ${errText}`);
      throw new Error(`PayPal partner referral failed: ${referralRes.status}`);
    }

    const referralData = await referralRes.json();
    
    // Find the action_url link
    const actionLink = referralData.links?.find(
      (l: { rel: string; href: string }) => l.rel === "action_url"
    );

    if (!actionLink?.href) {
      throw new Error("No onboarding URL returned from PayPal");
    }

    console.log(`[paypal-onboard] Created partner referral for user ${user.id}`);

    return new Response(
      JSON.stringify({
        url: actionLink.href,
        trackingId: user.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("PayPal Connect onboard error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
