// stripe-connect-payment-intent
// Creates a PaymentIntent + Customer + Ephemeral Key for in-app PaymentSheet
// (native) and Payment Element (web). Mirrors stripe-connect-checkout fee
// math, coupon logic, and Connect direct-charge routing — but returns a
// client_secret instead of redirecting to a hosted Checkout Session.
//
// Response:
//   { clientSecret, ephemeralKey, customerId, publishableKey,
//     paymentIntentId, amount, sellerAccountId }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REVIEWER_USER_IDS = new Set<string>([
  "5883f33c-07f3-4f6a-9a2d-a7e0ea864142",
]);

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

    const { items, shipping, couponCode, saveCard } = await req.json();
    if (!items || !items.length) throw new Error("No items provided");

    const serviceClient = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const itemIds = items.map((i: { id: string }) => i.id).filter(Boolean);
    if (itemIds.length !== items.length) throw new Error("Invalid item ids");

    const { data: listingRows, error: listingErr } = await serviceClient
      .from("listings")
      .select("id, user_id, status, price, title, images")
      .in("id", itemIds);
    if (listingErr || !listingRows || listingRows.length !== itemIds.length) {
      throw new Error("Could not verify listings");
    }
    if (listingRows.some((l: any) => l.status !== "active")) {
      throw new Error("One or more items are no longer available");
    }
    const sellerIds = Array.from(new Set(listingRows.map((l: any) => l.user_id)));
    if (sellerIds.length !== 1) {
      throw new Error("All items in a checkout must belong to the same seller");
    }
    const sellerId = sellerIds[0];
    if (sellerId === user.id) throw new Error("Cannot purchase your own items");

    const listingById = new Map(listingRows.map((l: any) => [l.id, l]));
    const authoritativeItems = itemIds.map((id: string) => {
      const l: any = listingById.get(id);
      return { id: l.id, title: l.title, price: Number(l.price) };
    });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "";

    // -------- DEMO BYPASS --------
    if (REVIEWER_USER_IDS.has(user.id)) {
      const orderGroupId = crypto.randomUUID();
      const shippingPerItem = (Number(shipping) || 0) / Math.max(authoritativeItems.length, 1);
      const { data: addr } = await serviceClient
        .from("buyer_addresses")
        .select("first_name,last_name,address,suburb,state,postcode")
        .eq("user_id", user.id).maybeSingle();
      const orderRows = authoritativeItems.map((it) => ({
        listing_id: it.id, buyer_id: user.id, seller_id: sellerId, status: "awaiting",
        price: it.price, shipping_price: shippingPerItem, order_group_id: orderGroupId,
        payment_method: "demo", checkout_reference: `demo-${orderGroupId}`,
        shipping_first_name: addr?.first_name ?? "App", shipping_last_name: addr?.last_name ?? "Reviewer",
        shipping_address: addr?.address ?? "1 Apple Park Way", shipping_city: addr?.suburb ?? "Sydney",
        shipping_state: addr?.state ?? "NSW", shipping_postcode: addr?.postcode ?? "2000",
      }));
      await serviceClient.from("orders").insert(orderRows);
      return new Response(JSON.stringify({
        demo: true,
        orderGroupId,
        checkoutReference: `demo-${orderGroupId}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const { data: sellerProfile } = await serviceClient
      .from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("user_id", sellerId).maybeSingle();
    if (!sellerProfile?.stripe_account_id || !sellerProfile.stripe_onboarding_complete) {
      return new Response(
        JSON.stringify({ error: "Seller is not set up to receive payments.", code: "seller_not_connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
      );
    }
    const sellerStripeAccountId = sellerProfile.stripe_account_id;

    // Verify seller can accept charges
    const acct = await stripe.accounts.retrieve(sellerStripeAccountId);
    if (!acct.charges_enabled || !acct.payouts_enabled) {
      return new Response(
        JSON.stringify({ error: "This seller is temporarily unable to accept payments.", code: "seller_payouts_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
      );
    }
    const sellerLabel =
      acct.business_profile?.name ||
      acct.settings?.dashboard?.display_name ||
      [acct.individual?.first_name, acct.individual?.last_name].filter(Boolean).join(" ") ||
      acct.company?.name || "";

    // Fees
    const itemsTotal = authoritativeItems.reduce((s, i) => s + i.price, 0);
    const shippingAmount = Number(shipping) || 0;
    const subtotal = itemsTotal + shippingAmount;
    const SECURE_CHECKOUT_RATE = 0.04;
    const SECURE_CHECKOUT_FIXED = 0.70;
    let secureCheckoutFee = Math.round((subtotal * SECURE_CHECKOUT_RATE + SECURE_CHECKOUT_FIXED) * 100) / 100;

    let appliedCoupon: { id: string; code: string; type: string } | null = null;
    const normalizedCode = String(couponCode || "").trim().toUpperCase();
    if (normalizedCode) {
      const { data: c } = await serviceClient
        .from("coupons")
        .select("id, code, type, active, starts_at, expires_at, max_redemptions, redemption_count")
        .eq("code", normalizedCode).maybeSingle();
      const now = Date.now();
      if (c && c.active
        && (!c.starts_at || new Date(c.starts_at).getTime() <= now)
        && (!c.expires_at || new Date(c.expires_at).getTime() >= now)
        && (c.max_redemptions === null || c.redemption_count < c.max_redemptions)) {
        if (c.type === "waive_buyer_fee") secureCheckoutFee = 0;
        appliedCoupon = { id: c.id, code: c.code, type: c.type };
      }
    }

    const buyerTotalDollars = subtotal + secureCheckoutFee;
    const amountCents = Math.round(buyerTotalDollars * 100);
    const applicationFeeAmount = Math.round(secureCheckoutFee * 100);

    // Find or create Stripe customer for the buyer (needed for saved cards + ephemeral key)
    let customerId: string | undefined;
    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    if (existing.data.length > 0) {
      customerId = existing.data[0].id;
    } else {
      const created = await stripe.customers.create({
        email: user.email,
        metadata: { flea_user_id: user.id },
      });
      customerId = created.id;
    }

    const description = sellerLabel ? `Flea — ${sellerLabel}` : "Flea order";

    // Idempotency: same buyer + same items + same total = same PI
    const idemBasis = `${user.id}|${itemIds.slice().sort().join(",")}|${amountCents}|${saveCard ? "s" : "n"}`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(idemBasis));
    const idemHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    const idempotencyKey = `flea-pi-${idemHash}`;

    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "aud",
      customer: customerId,
      description,
      statement_descriptor_suffix: "FLEA",
      application_fee_amount: applicationFeeAmount,
      on_behalf_of: sellerStripeAccountId,
      transfer_data: { destination: sellerStripeAccountId },
      automatic_payment_methods: { enabled: true },
      ...(saveCard ? { setup_future_usage: "off_session" as const } : {}),
      metadata: {
        item_ids: itemIds.join(","),
        secure_checkout_fee_aud: secureCheckoutFee.toFixed(2),
        buyer_total_aud: buyerTotalDollars.toFixed(2),
        flea_buyer_id: user.id,
        flea_seller_id: sellerId,
        ...(appliedCoupon ? { coupon_code: appliedCoupon.code, coupon_id: appliedCoupon.id } : {}),
      },
    }, { idempotencyKey });

    // Ephemeral key for the mobile PaymentSheet (lets the sheet list saved cards)
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2025-08-27.basil" }
    );

    if (appliedCoupon) {
      try {
        await serviceClient.from("coupon_redemptions").insert({
          coupon_id: appliedCoupon.id, user_id: user.id, checkout_reference: pi.id,
        });
      } catch (e) {
        console.warn("[stripe-connect-payment-intent] coupon redemption record failed:", (e as any)?.message);
      }
    }

    return new Response(JSON.stringify({
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      ephemeralKey: ephemeralKey.secret,
      customerId,
      publishableKey,
      amount: amountCents,
      currency: "aud",
      merchantDisplayName: "Flea",
      sellerAccountId: sellerStripeAccountId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    console.error("[stripe-connect-payment-intent] error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
