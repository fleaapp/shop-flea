// auto-refund-unshipped
// Runs hourly via pg_cron. Refunds any order that is still `awaiting` (i.e.
// not marked as shipped with eligible tracking) 9 days after purchase.
// Uses Stripe reverse_transfer + refund_application_fee so the buyer's
// Secure Checkout Fee (4% + $0.70) is also returned, and pulls the sale
// amount back from the seller's Connect balance.

import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REQUIRED_ORDER_COLUMNS = [
  "id",
  "buyer_id",
  "seller_id",
  "listing_id",
  "price",
  "shipping_price",
  "created_at",
  "status",
  "refunded_at",
  "shipped_at",
] as const;

const OPTIONAL_ORDER_COLUMNS = ["checkout_reference", "payment_method"] as const;

function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") return false;
  const code = typeof (error as any).code === "string" ? (error as any).code : "";
  const message = typeof (error as any).message === "string" ? (error as any).message : "";
  return (code === "42703" || code === "PGRST204") && message.includes(columnName);
}

function buildOrderSelect(omitted: Set<string>) {
  return [
    ...REQUIRED_ORDER_COLUMNS,
    ...OPTIONAL_ORDER_COLUMNS.filter((column) => !omitted.has(column)),
  ].join(",");
}

async function fetchAwaitingRefundOrders(admin: ReturnType<typeof createClient>, cutoff: string) {
  const dbUrl = Deno.env.get("EXTERNAL_SUPABASE_DB_URL") ?? Deno.env.get("SUPABASE_DB_URL") ?? "";
  if (dbUrl) {
    const sql = postgres(dbUrl, { max: 1 });
    try {
      const rows = await sql`
        SELECT id,
               buyer_id,
               seller_id,
               listing_id,
               price,
               shipping_price,
               created_at,
               status,
               refunded_at,
               shipped_at,
               checkout_reference,
               payment_method
        FROM public.orders
        WHERE status = 'awaiting'
          AND refunded_at IS NULL
          AND shipped_at IS NULL
          AND created_at <= ${cutoff}
      `;

      return rows.map((order: any) => ({
        ...order,
        checkout_reference: order.checkout_reference ?? null,
        payment_method: order.payment_method ?? "stripe",
      }));
    } finally {
      await sql.end();
    }
  }

  const omitted = new Set<string>();

  while (true) {
    const { data, error } = await admin
      .from("orders")
      .select(buildOrderSelect(omitted))
      .eq("status", "awaiting")
      .is("refunded_at", null)
      .is("shipped_at", null)
      .lte("created_at", cutoff);

    const missing = OPTIONAL_ORDER_COLUMNS.find((column) => !omitted.has(column) && isMissingColumnError(error, column));
    if (missing) {
      console.warn(`[auto-refund-unshipped] orders.${missing} missing, retrying without it`);
      omitted.add(missing);
      continue;
    }

    if (error) throw error;
    return (data ?? []).map((order: any) => ({
      ...order,
      checkout_reference: order.checkout_reference ?? null,
      payment_method: order.payment_method ?? "stripe",
    }));
  }
}

async function markOrderRefunded(orderId: string, refundReason: string) {
  const dbUrl = Deno.env.get("EXTERNAL_SUPABASE_DB_URL") ?? Deno.env.get("SUPABASE_DB_URL") ?? "";
  const refundedAt = new Date();

  if (!dbUrl) {
    throw new Error("Database connection is not configured.");
  }

  const sql = postgres(dbUrl, { max: 1 });
  try {
    const rows = await sql`
      UPDATE public.orders
      SET refunded_at = ${refundedAt},
          refund_reason = ${refundReason},
          updated_at = ${refundedAt}
      WHERE id = ${orderId}
      RETURNING id
    `;

    if (rows.length === 0) {
      throw new Error("No matching order row was updated.");
    }
  } finally {
    await sql.end();
  }
}

function isDemoOrder(order: any) {
  return order.payment_method === "demo" || (typeof order.checkout_reference === "string" && order.checkout_reference.startsWith("demo-"));
}

async function resolvePaymentIntentId(stripe: Stripe, order: any) {
  const reference = typeof order.checkout_reference === "string" ? order.checkout_reference.trim() : "";

  if (reference.startsWith("pi_")) return reference;

  if (reference.startsWith("cs_")) {
    const session = await stripe.checkout.sessions.retrieve(reference);
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
    if (paymentIntentId) return paymentIntentId;
  }

  if (reference && !reference.startsWith("demo-")) {
    try {
      const pi = await stripe.paymentIntents.retrieve(reference);
      if (pi?.id) return pi.id;
    } catch (_) {
      // Continue to metadata lookup.
    }
  }

  const createdAt = order.created_at ? Math.floor(new Date(order.created_at).getTime() / 1000) : null;
  const earliestCreated = Math.max(0, (createdAt ?? Math.floor(Date.now() / 1000)) - 30 * 24 * 60 * 60);
  const latestCreated = (createdAt ?? Math.floor(Date.now() / 1000)) + 2 * 24 * 60 * 60;
  const matchesOrder = (pi: Stripe.PaymentIntent) => {
    const metadata = pi.metadata ?? {};
    const itemIds = String(metadata.item_ids ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    return metadata.flea_buyer_id === order.buyer_id
      && metadata.flea_seller_id === order.seller_id
      && (!order.listing_id || itemIds.includes(order.listing_id))
      && pi.created >= earliestCreated
      && pi.created <= latestCreated
      && ["succeeded", "requires_capture", "processing"].includes(pi.status);
  };

  try {
    const query = [
      `metadata['flea_buyer_id']:'${String(order.buyer_id).replace(/'/g, "\\'")}'`,
      `metadata['flea_seller_id']:'${String(order.seller_id).replace(/'/g, "\\'")}'`,
      `created>${earliestCreated}`,
    ].join(" AND ");
    const result = await stripe.paymentIntents.search({ query, limit: 20 });
    const match = result.data.find(matchesOrder);
    if (match) return match.id;
  } catch (error) {
    console.warn("[auto-refund-unshipped] PaymentIntent search failed, trying recent list", error);
  }

  const recent = await stripe.paymentIntents.list({ created: { gte: earliestCreated }, limit: 100 });
  const match = recent.data.find(matchesOrder);
  if (match) return match.id;

  try {
    const sessions = await stripe.checkout.sessions.list({ created: { gte: earliestCreated }, limit: 100 });
    const sessionMatch = sessions.data.find((session) => {
      const metadata = session.metadata ?? {};
      const itemIds = String(metadata.item_ids ?? "").split(",").map((id) => id.trim()).filter(Boolean);
      return metadata.flea_buyer_id === order.buyer_id
        && (!order.listing_id || itemIds.includes(order.listing_id))
        && session.created >= earliestCreated
        && session.created <= latestCreated
        && ["paid", "no_payment_required"].includes(session.payment_status);
    });
    const paymentIntentId = typeof sessionMatch?.payment_intent === "string"
      ? sessionMatch.payment_intent
      : sessionMatch?.payment_intent?.id;
    if (paymentIntentId) return paymentIntentId;
  } catch (error) {
    console.warn("[auto-refund-unshipped] Checkout Session lookup failed", error);
  }

  throw new Error("payment reference not found");
}

async function firePush(userId: string, notification: Record<string, unknown>) {
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "https://teaicrimlqdayqpmxasc.supabase.co";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    await fetch(`${url}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ user_id: userId, notification }),
    });
  } catch (e) {
    console.error("[auto-refund-unshipped] push failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expectedKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const cutoff = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
    const orders = await fetchAwaitingRefundOrders(admin, cutoff);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    let refunded = 0;
    const failures: any[] = [];

    for (const order of orders ?? []) {
      try {
        // Demo (Apple Review) orders bypass the payment provider.
        if (!isDemoOrder(order)) {
          const paymentIntentId = await resolvePaymentIntentId(stripe, order);
          await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reverse_transfer: true,
            refund_application_fee: true,
            reason: "requested_by_customer",
            metadata: {
              flea_order_id: order.id,
              flea_seller_id: order.seller_id,
              flea_buyer_id: order.buyer_id,
              flea_auto_refund: "unshipped_9d",
            },
          }, { idempotencyKey: `flea-auto-refund-${order.id}` });
        }

        await markOrderRefunded(order.id, "auto_unshipped_9d");

        // Reactivate the listing so it's not stuck as sold.
        await admin
          .from("listings")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", order.listing_id);

        // Notify buyer and seller.
        await admin.from("notifications").insert([
          {
            user_id: order.buyer_id,
            type: "order_auto_refunded",
            title: "Order refunded",
            message: "💸 Your order was automatically refunded because the seller didn't ship within 9 days. Funds will appear in 5 to 10 days.",
            related_listing_id: order.listing_id,
            related_user_id: order.seller_id,
            related_order_id: order.id,
          },
          {
            user_id: order.seller_id,
            type: "sale_auto_refunded",
            title: "Sale auto-refunded",
            message: "⚠️ Your sale was automatically refunded because tracking wasn't added within 9 days. Repeated auto-refunds may affect your account.",
            related_listing_id: order.listing_id,
            related_user_id: order.buyer_id,
            related_order_id: order.id,
          },
        ]);

        firePush(order.buyer_id, { type: "order_auto_refunded", title: "Order refunded", message: "Your order was automatically refunded because the seller didn't ship within 9 days." });
        firePush(order.seller_id, { type: "sale_auto_refunded", title: "Sale auto-refunded", message: "Your sale was auto-refunded because tracking wasn't added within 9 days." });

        // Audit trail.
        try {
          await admin.from("payment_events").insert({
            event_type: "auto_refund_unshipped",
            order_id: order.id,
            metadata: { reason: "unshipped_9d", days: 9 },
          });
        } catch (_) { /* payment_events schema tolerant */ }

        refunded += 1;
      } catch (e: any) {
        console.error(`[auto-refund-unshipped] order ${order.id} failed`, e?.message);
        failures.push({ orderId: order.id, error: e?.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, refunded, failures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[auto-refund-unshipped] fatal", e);
    return new Response(JSON.stringify({ error: e?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
