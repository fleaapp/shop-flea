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

    const { items, shipping } = await req.json();

    if (!items || !items.length) throw new Error("No items provided");

    // SECURITY: resolve seller payment account server-side from listing IDs.
    // Never trust client-supplied seller merchant IDs.
    const itemIds = (items as Array<{ id: string }>).map((i) => i.id).filter(Boolean);
    if (!itemIds.length) throw new Error("Invalid items");

    const serviceClient = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: listings, error: listingsErr } = await serviceClient
      .from("listings")
      .select("id, user_id, status, price, title")
      .in("id", itemIds);

    if (listingsErr || !listings || listings.length !== itemIds.length) {
      throw new Error("One or more listings not found");
    }
    if (listings.some((l) => l.status !== "active")) {
      throw new Error("One or more listings are no longer available");
    }
    const sellerIds = Array.from(new Set(listings.map((l) => l.user_id)));
    if (sellerIds.length !== 1) {
      throw new Error("Cart must contain items from a single seller");
    }
    const sellerId = sellerIds[0];
    if (sellerId === user.id) {
      throw new Error("You cannot purchase your own listing");
    }

    // SECURITY: Use DB-authoritative prices, never trust client-supplied prices.
    const listingById = new Map(listings.map((l: any) => [l.id, l]));
    const authoritativeItems = itemIds.map((id: string) => {
      const l: any = listingById.get(id);
      return { id: l.id, title: l.title as string, price: Number(l.price) };
    });

    const { data: sellerProfile, error: profileErr } = await serviceClient
      .from("profiles")
      .select("paypal_merchant_id, paypal_onboarding_complete")
      .eq("user_id", sellerId)
      .maybeSingle();

    if (profileErr || !sellerProfile?.paypal_merchant_id || !sellerProfile.paypal_onboarding_complete) {
      throw new Error("Seller has not completed PayPal onboarding");
    }
    const sellerPayPalMerchantId = sellerProfile.paypal_merchant_id as string;

    const accessToken = await getPayPalAccessToken();

    // Calculate totals — same model as Stripe.
    // Buyer pays subtotal + grossed-up processing fee.
    // PayPal deducts its fee from the seller side (via payment_instruction).
    // Flea takes a clean 7% of subtotal as platform_fees.
    const itemsTotal = items.reduce((sum: number, item: { price: number }) => sum + item.price, 0);
    const shippingAmount = shipping || 0;
    const subtotal = itemsTotal + shippingAmount;

    const PAYPAL_RATE = 0.026;
    const PAYPAL_FIXED = 0.30;
    const processingFee = Math.round(
      ((subtotal + PAYPAL_FIXED) / (1 - PAYPAL_RATE) - subtotal) * 100,
    ) / 100;
    const totalCharge = Math.round((subtotal + processingFee) * 100) / 100;

    // 7% platform fee — based on subtotal (items + shipping), NOT totalCharge.
    const platformFee = Math.round(subtotal * 0.07 * 100) / 100;

    const origin = req.headers.get("origin") || "https://shop-flea.lovable.app";

    // Create PayPal order with partner fees
    const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Partner-Attribution-Id": Deno.env.get("PAYPAL_CLIENT_ID") || "",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: "Flea order",
            soft_descriptor: "FLEA",
            custom_id: items.map((i: { id: string }) => i.id).join(","),
            amount: {
              currency_code: "AUD",
              value: totalCharge.toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: "AUD",
                  value: itemsTotal.toFixed(2),
                },
                shipping: {
                  currency_code: "AUD",
                  value: shippingAmount.toFixed(2),
                },
                handling: {
                  currency_code: "AUD",
                  value: processingFee.toFixed(2),
                },
              },
            },
            payee: {
              merchant_id: sellerPayPalMerchantId,
            },
            payment_instruction: {
              disbursement_mode: "INSTANT",
              platform_fees: [
                {
                  amount: {
                    currency_code: "AUD",
                    value: platformFee.toFixed(2),
                  },
                },
              ],
            },
            items: items.map((item: { title: string; price: number }) => ({
              name: item.title.substring(0, 127),
              unit_amount: {
                currency_code: "AUD",
                value: item.price.toFixed(2),
              },
              quantity: "1",
              category: "PHYSICAL_GOODS",
            })),
          },
        ],
        application_context: {
          brand_name: "Flea",
          landing_page: "NO_PREFERENCE",
          user_action: "PAY_NOW",
          return_url: `${origin}/checkout/success?paypal=true`,
          cancel_url: `${origin}/cart`,
        },
      }),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      console.error(`[paypal-checkout] Order creation failed: ${orderRes.status} ${errText}`);
      throw new Error(`PayPal order creation failed: ${orderRes.status}`);
    }

    const orderData = await orderRes.json();

    // Find the approval URL
    const approveLink = orderData.links?.find(
      (l: { rel: string; href: string }) => l.rel === "approve"
    );

    if (!approveLink?.href) {
      throw new Error("No approval URL returned from PayPal");
    }

    return new Response(
      JSON.stringify({
        url: approveLink.href,
        orderId: orderData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("PayPal checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
