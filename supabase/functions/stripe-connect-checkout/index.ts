import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { items, shipping, sellerStripeAccountId } = await req.json();

    if (!items || !items.length) throw new Error("No items provided");
    if (!sellerStripeAccountId) throw new Error("Seller Stripe account is required");

    const userEmail = user.email;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Calculate totals
    const itemsTotal = items.reduce((sum: number, item: { price: number }) => sum + item.price, 0);
    const shippingAmount = shipping || 0;
    const subtotal = itemsTotal + shippingAmount;
    
    // 2% + $0.30 buyer processing fee (covers Stripe's costs)
    const processingFee = subtotal * 0.02 + 0.30;
    const totalCharge = subtotal + processingFee;
    
    // 7% platform fee on the subtotal (items + shipping)
    const platformFeeDollars = subtotal * 0.07;
    
    // application_fee_amount = platform fee + processing fee
    // This keeps the processing fee with the platform to cover Stripe's charges
    // Seller receives: totalCharge - application_fee = subtotal - platformFee = 93% of (items + shipping)
    const applicationFeeAmount = Math.round((platformFeeDollars + processingFee) * 100); // in cents

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
      (item: { title: string; price: number; image?: string }) => ({
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

    // Add 2% processing fee as a line item
    lineItems.push({
      price_data: {
        currency: "aud",
        product_data: { name: "Processing fee (2%)" },
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

    // Create checkout session with destination charge
    // Money goes directly to seller, platform fee is deducted
    // Enable card, Apple Pay, Google Pay — no Link/Stripe login for simpler buyer UX
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      customer_creation: customerId ? undefined : 'if_required',
      line_items: lineItems,
      mode: "payment",
      payment_method_types: ['card'],
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: sellerStripeAccountId,
        },
      },
      metadata: {
        item_ids: items.map((i: { id: string }) => i.id).join(","),
      },
    });

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
