import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Apple App Review demo account(s). When signed in as any of these UUIDs,
// checkout skips Stripe entirely and inserts orders directly so reviewers
// can complete the full purchase flow without real card processing.
const REVIEWER_USER_IDS = new Set<string>([
  "5883f33c-07f3-4f6a-9a2d-a7e0ea864142", // appreview@finditonflea.com
]);


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate against the external Supabase project where users sign in
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

    const { items, shipping } = await req.json();

    if (!items || !items.length) throw new Error("No items provided");

    // SECURITY: Never trust a client-supplied seller Stripe account id.
    // Resolve it server-side from the listing IDs using the service role,
    // and verify all items belong to the same active seller.
    const serviceClient = createClient(
      Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '',
      Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const itemIds = items.map((i: { id: string }) => i.id).filter(Boolean);
    if (itemIds.length !== items.length) throw new Error("Invalid item ids");

    const { data: listingRows, error: listingErr } = await serviceClient
      .from('listings')
      .select('id, user_id, status, price, title, images')
      .in('id', itemIds);
    if (listingErr || !listingRows || listingRows.length !== itemIds.length) {
      throw new Error("Could not verify listings");
    }
    if (listingRows.some((l: any) => l.status !== 'active')) {
      throw new Error("One or more items are no longer available");
    }
    const sellerIds = Array.from(new Set(listingRows.map((l: any) => l.user_id)));
    if (sellerIds.length !== 1) {
      throw new Error("All items in a checkout must belong to the same seller");
    }
    const sellerId = sellerIds[0];
    if (sellerId === user.id) throw new Error("Cannot purchase your own items");

    // SECURITY: Use DB-authoritative prices, never trust client-supplied prices.
    const listingById = new Map(listingRows.map((l: any) => [l.id, l]));
    const authoritativeItems = itemIds.map((id: string) => {
      const l: any = listingById.get(id);
      return {
        id: l.id,
        title: l.title,
        price: Number(l.price),
        image: Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : undefined,
      };
    });

    // -------- DEMO BYPASS (Apple App Review) --------
    // Skip Stripe end-to-end: insert paid orders directly, mark listings sold,
    // and return a synthetic success URL the frontend recognises via ?demo=1.
    if (REVIEWER_USER_IDS.has(user.id)) {
      const origin = req.headers.get("origin") || "https://shop-flea.lovable.app";
      const orderGroupId = crypto.randomUUID();
      const shippingPerItem = (Number(shipping) || 0) / Math.max(authoritativeItems.length, 1);

      // Fetch reviewer's shipping address (best-effort).
      const { data: addr } = await serviceClient
        .from('buyer_addresses')
        .select('first_name,last_name,address,suburb,state,postcode')
        .eq('user_id', user.id)
        .maybeSingle();

      const orderRows = authoritativeItems.map((it) => ({
        listing_id: it.id,
        buyer_id: user.id,
        seller_id: sellerId,
        status: 'awaiting',
        price: it.price,
        shipping_price: shippingPerItem,
        order_group_id: orderGroupId,
        payment_method: 'demo',
        checkout_reference: `demo-${orderGroupId}`,
        shipping_first_name: addr?.first_name ?? 'App',
        shipping_last_name: addr?.last_name ?? 'Reviewer',
        shipping_address: addr?.address ?? '1 Apple Park Way',
        shipping_city: addr?.suburb ?? 'Sydney',
        shipping_state: addr?.state ?? 'NSW',
        shipping_postcode: addr?.postcode ?? '2000',
      }));

      const { error: insertErr } = await serviceClient.from('orders').insert(orderRows);
      if (insertErr) {
        console.error('[demo-bypass] order insert failed:', insertErr);
        return new Response(JSON.stringify({ error: 'Demo order insert failed', detail: insertErr.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      const successUrl = `${origin}/checkout/success?demo=1&order_group=${orderGroupId}`;
      return new Response(JSON.stringify({ url: successUrl, sessionId: `demo-${orderGroupId}`, demo: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    // -------- END DEMO BYPASS --------


    const { data: sellerProfile, error: profileErr } = await serviceClient
      .from('profiles')
      .select('stripe_account_id, stripe_onboarding_complete')
      .eq('user_id', sellerId)
      .maybeSingle();
    if (profileErr || !sellerProfile?.stripe_account_id || !sellerProfile.stripe_onboarding_complete) {
      return new Response(
        JSON.stringify({ error: "Seller is not set up to receive payments.", code: "seller_not_connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
      );
    }
    const sellerStripeAccountId = sellerProfile.stripe_account_id;

    const userEmail = user.email;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Calculate totals from DB-authoritative prices.
    const itemsTotal = authoritativeItems.reduce((sum, item) => sum + item.price, 0);
    const shippingAmount = shipping || 0;
    const subtotal = itemsTotal + shippingAmount;

    // Secure Checkout Fee — flat 4% + $0.70 of items + shipping, paid by buyer.
    // This is Flea's revenue line; Stripe's actual processing cost is deducted
    // from it (funded out of application_fee_amount).
    const SECURE_CHECKOUT_RATE = 0.04;
    const SECURE_CHECKOUT_FIXED = 0.70;
    const secureCheckoutFee = Math.round((subtotal * SECURE_CHECKOUT_RATE + SECURE_CHECKOUT_FIXED) * 100) / 100;
    const buyerTotalDollars = subtotal + secureCheckoutFee;

    // No seller-side platform fee. Flea's take = the full Secure Checkout Fee
    // (Stripe deducts its actual ~1.75% + $0.30 from this via on_behalf_of).
    const applicationFeeAmount = Math.round(secureCheckoutFee * 100);

    // Build line items from DB-authoritative items.
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = authoritativeItems.map(
      (item) => ({
        price_data: {
          currency: "aud",
          product_data: {
            name: item.title,
            ...(item.image ? { images: [item.image] } : {}),
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: 1,
      })
    );

    // Add shipping as a line item if > 0
    if (shippingAmount > 0) {
      lineItems.push({
        price_data: {
          currency: "aud",
          product_data: { name: "Shipping" },
          unit_amount: Math.round(shippingAmount * 100),
        },
        quantity: 1,
      });
    }

    // Add buyer-paid processing fee as a line item
    lineItems.push({
      price_data: {
        currency: "aud",
        product_data: { name: `Payment processing fee (${(STRIPE_RATE * 100).toFixed(2)}% + $${STRIPE_FIXED.toFixed(2)})` },
        unit_amount: Math.round(processingFee * 100),
      },
      quantity: 1,
    });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://shop-flea.lovable.app";

    // Live re-verify that the seller can actually receive funds RIGHT NOW.
    // We don't trust the cached profile flag — Stripe can disable charges or
    // payouts at any time (KYC lapses, risk review, dispute volume, etc.).
    // If we let an order through here, buyer is charged but seller can't be
    // paid out and we end up holding the bag.
    let sellerLabel = "";
    try {
      const acct = await stripe.accounts.retrieve(sellerStripeAccountId);
      if (!acct.charges_enabled || !acct.payouts_enabled) {
        return new Response(
          JSON.stringify({
            error: "This seller is temporarily unable to accept payments. Please try again later or contact support.",
            code: "seller_payouts_disabled",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
        );
      }
      sellerLabel =
        acct.business_profile?.name ||
        acct.settings?.dashboard?.display_name ||
        (acct as any).display_name ||
        [acct.individual?.first_name, acct.individual?.last_name].filter(Boolean).join(" ") ||
        acct.company?.name ||
        "";
    } catch (e) {
      console.error("[stripe-connect-checkout] account retrieve failed:", e);
      return new Response(
        JSON.stringify({ error: "Could not verify seller payment status. Please try again.", code: "seller_lookup_failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 },
      );
    }

    // Receipt/description: co-branded so buyers see both Flea and the seller.
    const description = sellerLabel ? `Flea — ${sellerLabel}` : "Flea order";

    // Create checkout session.
    // - on_behalf_of: connected account's business name shows as merchant on
    //   the receipt; their statement descriptor drives the bank statement.
    // - statement_descriptor_suffix "FLEA": appended to seller descriptor so
    //   buyers see e.g. "SELLERCO* FLEA" on their card statement.
    // Idempotency key derived from buyer + items + total. Prevents accidental
    // duplicate sessions if the client retries before the first response.
    const idemBasis = `${user.id}|${items.map((i: { id: string }) => i.id).sort().join(",")}|${Math.round(buyerTotalDollars * 100)}`;
    let idemHash = "";
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(idemBasis));
      idemHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    } catch { idemHash = `${Date.now()}`; }
    const idempotencyKey = `flea-cs-${idemHash}`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      customer_creation: customerId ? undefined : 'if_required',
      line_items: lineItems,
      mode: "payment",
      payment_method_types: ['card', 'link'],
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        on_behalf_of: sellerStripeAccountId,
        transfer_data: {
          destination: sellerStripeAccountId,
        },
        description,
        statement_descriptor_suffix: "FLEA",
      },
      metadata: {
        item_ids: items.map((i: { id: string }) => i.id).join(","),
        platform_fee_aud: platformFeeDollars.toFixed(2),
        processing_fee_aud: processingFee.toFixed(2),
        buyer_total_aud: buyerTotalDollars.toFixed(2),
        flea_buyer_id: user.id,
      },
    }, { idempotencyKey });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Stripe Connect checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
