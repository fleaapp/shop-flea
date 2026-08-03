// reconcile-orphan-payments
// Safety net for C1: a buyer's card is charged but the app crashes / loses
// connection before finalize-checkout creates the order rows. Runs every
// 15 minutes via pg_cron. Any Flea payment intent that succeeded more than
// 15 minutes ago with no matching order row is refunded in full (including
// the application fee and any transfer to the seller) and the buyer is told.

import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const GRACE_MS = 15 * 60 * 1000;
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Not authorised" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2025-08-27.basil",
  });

  const now = Date.now();
  let scanned = 0;
  let refunded = 0;
  const errors: string[] = [];

  try {
    const list = await stripe.paymentIntents.list({
      created: { gte: Math.floor((now - LOOKBACK_MS) / 1000), lte: Math.floor((now - GRACE_MS) / 1000) },
      limit: 100,
    });

    for (const pi of list.data) {
      if (pi.status !== "succeeded") continue;
      const buyerId = pi.metadata?.flea_buyer_id;
      if (!buyerId) continue; // not a Flea marketplace charge
      scanned++;

      const { data: orders, error } = await admin
        .from("orders")
        .select("id")
        .eq("checkout_reference", pi.id)
        .limit(1);
      if (error) {
        errors.push(`${pi.id}: ${error.message}`);
        continue;
      }
      if ((orders ?? []).length > 0) continue; // order exists, nothing to do

      // No order was ever created for a successful charge -> refund it all.
      try {
        await stripe.refunds.create({
          payment_intent: pi.id,
          reason: "requested_by_customer",
          refund_application_fee: true,
          reverse_transfer: true,
        }, { idempotencyKey: `orphan-refund-${pi.id}` });
        refunded++;

        await admin.from("notifications").insert({
          user_id: buyerId,
          type: "payment_failed",
          title: "Payment refunded",
          message:
            "💳 Your order didn't complete, so we've refunded your payment in full. It can take a few business days to appear.",
        });

        await logEdgeError({
          functionName: "reconcile-orphan-payments",
          error: new Error(`Orphan payment refunded: ${pi.id} (${(pi.amount ?? 0) / 100} AUD)`),
          source: "edge_function",
        });
      } catch (e: any) {
        // Already refunded is fine.
        if (String(e?.raw?.code ?? "") === "charge_already_refunded") continue;
        errors.push(`${pi.id}: ${e?.message ?? "refund failed"}`);
      }
    }
  } catch (err: any) {
    await logEdgeError({ functionName: "reconcile-orphan-payments", error: err, source: "edge_function" });
    return new Response(JSON.stringify({ error: "Reconciliation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ scanned, refunded, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
