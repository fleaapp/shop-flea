// stripe-connect-payment-intent
// Creates a PaymentIntent + Customer + Ephemeral Key for in-app PaymentSheet
// (native) and Payment Element (web). Mirrors stripe-connect-checkout fee
// math, coupon logic, and Connect direct-charge routing — but returns a
// client_secret instead of redirecting to a hosted Checkout Session.
//
// Response:
//   { clientSecret, ephemeralKey, customerId, publishableKey,
//     paymentIntentId, amount, sellerAccountId, clientStripeAccountId }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isStripePermissionError, logStripeScopeGap } from "../_shared/stripeErrors.ts";

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

    const { items, shipping, shippingBySeller, expectedAmountCents, couponCode, saveCard } = await req.json();
    const jsonError = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
      new Response(JSON.stringify({ error: message, code, ...extra }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });
    if (!items || !items.length) {
      return jsonError(400, "no_items", "No items provided.");
    }


    // Gate: block buying while the buyer has a negative Stripe Connect balance
    // (i.e. they owe money as a seller). They must settle before making new purchases.
    {
      const svc = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data: buyerProfile } = await svc
        .from("profiles")
        .select("negative_balance_cents")
        .eq("user_id", user.id)
        .maybeSingle();
      const owed = Number(buyerProfile?.negative_balance_cents ?? 0);
      if (owed > 0) {
        return new Response(
          JSON.stringify({ error: "negative_balance", code: "negative_balance", amountCents: owed }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const itemIds = items.map((i: { id: string }) => i.id).filter(Boolean);
    if (itemIds.length !== items.length) throw new Error("Invalid item ids");

    const { data: listingRows, error: listingErr } = await serviceClient
      .from("listings")
      .select("id, user_id, status, price, title, images, shipping_price")
      .in("id", itemIds);
    const itemIds = items.map((i: { id: string }) => i.id).filter(Boolean);
    if (itemIds.length !== items.length) {
      return jsonError(400, "invalid_item_ids", "Invalid item ids.");
    }

    const { data: listingRows, error: listingErr } = await serviceClient
      .from("listings")
      .select("id, user_id, status, price, title, images, shipping_price")
      .in("id", itemIds);
    if (listingErr || !listingRows || listingRows.length !== itemIds.length) {
      return jsonError(409, "listings_unavailable", "Could not verify the items in your cart. Please refresh and try again.");
    }
    if (listingRows.some((l: any) => l.status !== "active")) {
      return jsonError(409, "item_no_longer_available", "One or more items are no longer available.");
    }
    const sellerIds = Array.from(new Set(listingRows.map((l: any) => l.user_id)));
    if (sellerIds.length !== 1) {
      return jsonError(400, "multi_seller_checkout", "All items in a checkout must belong to the same seller.");
    }
    const sellerId = sellerIds[0];
    if (sellerId === user.id) {
      return jsonError(400, "own_item", "You can't purchase your own items.");
    }


    const listingById = new Map(listingRows.map((l: any) => [l.id, l]));
    const authoritativeItems = itemIds.map((id: string) => {
      const l: any = listingById.get(id);
      return { id: l.id, title: l.title, price: Number(l.price), shippingPrice: Number(l.shipping_price || 0) };
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
      .select("stripe_account_id, bundle_shipping_mode, bundle_shipping_discount_percent")
      .eq("user_id", sellerId).maybeSingle();
    if (!sellerProfile?.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: "Seller is not set up to receive payments.", code: "seller_not_connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
      );
    }
    const sellerStripeAccountId = sellerProfile.stripe_account_id;

    // Verify seller can accept charges. payouts_enabled is intentionally NOT
    // required — brand new AU sellers can have payouts paused during Stripe's
    // fraud-hold window but are still able to accept charges legitimately.
    // If our Stripe key is a restricted key without accounts_kyc_basic_read
    // scope, this call throws — degrade gracefully rather than block checkout.
    let sellerLabel = "";
    try {
      const acct = await stripe.accounts.retrieve(sellerStripeAccountId);
      if (!acct.charges_enabled) {
        return new Response(
          JSON.stringify({ error: "This seller is temporarily unable to accept payments.", code: "seller_charges_disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
        );
      }
      sellerLabel =
        acct.business_profile?.name ||
        acct.settings?.dashboard?.display_name ||
        [acct.individual?.first_name, acct.individual?.last_name].filter(Boolean).join(" ") ||
        acct.company?.name || "";
    } catch (e) {
      if (isStripePermissionError(e)) {
        console.warn("[stripe-connect-payment-intent] scope gap on accounts.retrieve — proceeding without preflight");
        await logStripeScopeGap(serviceClient, "stripe-connect-payment-intent", e, { sellerStripeAccountId });
        // Continue: Stripe will still reject the PaymentIntent if the account
        // truly cannot accept charges, and the buyer will see a real error.
      } else {
        throw e;
      }
    }

    // Fees
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const itemsTotal = authoritativeItems.reduce((s, i) => s + i.price, 0);
    const rawShippingAmount = authoritativeItems.reduce((s, i) => s + (Number(i.shippingPrice) || 0), 0);
    const isBundle = authoritativeItems.length >= 2;
    const bundleMode = String((sellerProfile as any)?.bundle_shipping_mode || "none");
    const bundleDiscountPercent = Number((sellerProfile as any)?.bundle_shipping_discount_percent || 0);
    let shippingAmount = rawShippingAmount;
    if (isBundle && bundleMode === "free") {
      shippingAmount = 0;
    } else if (isBundle && bundleMode === "discounted" && bundleDiscountPercent > 0) {
      const pct = Math.max(0, Math.min(100, bundleDiscountPercent));
      shippingAmount = rawShippingAmount * (1 - pct / 100);
    }
    shippingAmount = round2(shippingAmount);

    const clientShippingTotal = Array.isArray(shippingBySeller)
      ? shippingBySeller.reduce((sum: number, entry: unknown) => {
          const pair = Array.isArray(entry) ? entry : [];
          return sum + Number(pair[1] || 0);
        }, 0)
      : Number(shipping) || 0;
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
      console.log("[coupon] input=", couponCode, "normalized=", normalizedCode, "matched=", !!appliedCoupon, "fee=", secureCheckoutFee);
    }

    const buyerTotalDollars = subtotal + secureCheckoutFee;
    const amountCents = Math.round(buyerTotalDollars * 100);
    const applicationFeeAmount = Math.round(secureCheckoutFee * 100);

    const clientExpectedAmountCents = Number(expectedAmountCents);
    if (Number.isFinite(clientExpectedAmountCents) && Math.round(clientExpectedAmountCents) !== amountCents) {
      console.warn("[stripe-connect-payment-intent] amount mismatch", {
        itemIds,
        itemsTotal,
        rawShippingAmount: round2(rawShippingAmount),
        serverShippingAmount: shippingAmount,
        clientShippingTotal: round2(clientShippingTotal),
        secureCheckoutFee,
        serverAmountCents: amountCents,
        clientExpectedAmountCents: Math.round(clientExpectedAmountCents),
        bundleMode,
        bundleDiscountPercent,
      });
      return new Response(JSON.stringify({
        error: "Checkout total changed. Please reopen checkout and try again.",
        code: "checkout_amount_mismatch",
        serverAmountCents: amountCents,
        clientExpectedAmountCents: Math.round(clientExpectedAmountCents),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 });
    }

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

    // Idempotency: include EVERY parameter that materially changes the
    // PaymentIntent request. If any of these change (coupon toggled, seller
    // changed, fee logic changed, request shape bumped), we get a fresh key
    // and never collide with a stale one Stripe cached for 24h.
    // PI_REQUEST_VERSION: bump whenever the paymentIntents.create body shape
    // changes so old cached keys can't collide with new params.
    const PI_REQUEST_VERSION = "v4-2026-07-22-bundle-shipping";
    const idemBasis = [
      PI_REQUEST_VERSION,
      user.id,
      customerId ?? "",
      sellerStripeAccountId,
      itemIds.slice().sort().join(","),
      amountCents,
      applicationFeeAmount,
      appliedCoupon?.code ?? "",
      saveCard ? "s" : "n",
    ].join("|");
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(idemBasis));
    const idemHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    const baseIdempotencyKey = `flea-pi-${idemHash}`;

    const piParams: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency: "aud",
      customer: customerId,
      description,
      statement_descriptor_suffix: "FLEA",
      application_fee_amount: applicationFeeAmount,
      on_behalf_of: sellerStripeAccountId,
      transfer_data: { destination: sellerStripeAccountId },
      automatic_payment_methods: { enabled: true },
      // Let issuers challenge with 3DS instead of hard-declining a first-time
      // manual card entry on a new merchant descriptor.
      payment_method_options: { card: { request_three_d_secure: "automatic" } },
      ...(saveCard ? { setup_future_usage: "off_session" as const } : {}),
      metadata: {
        item_ids: itemIds.join(","),
        secure_checkout_fee_aud: secureCheckoutFee.toFixed(2),
        buyer_total_aud: buyerTotalDollars.toFixed(2),
        flea_buyer_id: user.id,
        flea_seller_id: sellerId,
        ...(appliedCoupon ? { coupon_code: appliedCoupon.code, coupon_id: appliedCoupon.id } : {}),
      },
    };

    // Retry on idempotency conflict — a stale key from an earlier deploy would
    // otherwise block this buyer for 24h. We retry once with a random suffix.
    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.create(piParams, { idempotencyKey: baseIdempotencyKey });
    } catch (e: any) {
      const isIdemConflict =
        e?.type === "StripeIdempotencyError" ||
        e?.rawType === "idempotency_error" ||
        String(e?.raw?.type ?? "") === "idempotency_error";
      if (!isIdemConflict) throw e;
      const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      console.warn(
        `[stripe-connect-payment-intent] idempotency conflict on ${baseIdempotencyKey}; retrying with fresh key`,
      );
      pi = await stripe.paymentIntents.create(piParams, {
        idempotencyKey: `${baseIdempotencyKey}-r${suffix}`,
      });
    }

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
      livemode: Boolean(pi.livemode),
      amount: amountCents,
      currency: "aud",
      merchantDisplayName: "Flea",
      sellerAccountId: sellerStripeAccountId,
      // Destination-charge PaymentIntents live on the platform account. Keep
      // client confirmation on the platform; only set this for future direct
      // charges created with a Stripe-Account request option.
      clientStripeAccountId: null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    console.error("[stripe-connect-payment-intent] error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
