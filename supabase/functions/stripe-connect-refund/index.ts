// stripe-connect-refund
// Seller-approved refund execution. Called from the in-app refund flow AFTER
// the seller has explicitly approved a buyer's refund request (or after
// policy-based escalation). Stripe handles only the financial execution —
// approval/decision logic happens in the app.
//
// Uses reverse_transfer + refund_application_fee so the seller payout AND the
// buyer's Secure Checkout Fee (4% + $0.70) are unwound cleanly through Connect.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUIRED_ORDER_COLUMNS = [
  "id",
  "listing_id",
  "buyer_id",
  "seller_id",
  "price",
  "shipping_price",
  "created_at",
] as const;

const OPTIONAL_ORDER_COLUMNS = [
  "checkout_reference",
  "payment_method",
  "refunded_at",
  "delivered_at",
  "shipped_at",
  "order_group_id",
  "status",
] as const;

const ORDER_UPDATE_FALLBACK_COLUMNS = [
  "updated_at",
  "refund_reason",
] as const;

async function reloadExternalSchemaCache() {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return;
    await fetch(`${supabaseUrl}/functions/v1/reload-schema`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    });
  } catch (error) {
    console.error("[stripe-connect-refund] Schema reload trigger failed:", error);
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") return false;
  const code = typeof (error as any).code === "string" ? (error as any).code : "";
  const message = typeof (error as any).message === "string" ? (error as any).message : "";
  return (code === "42703" || code === "PGRST204") && message.includes(columnName);
}

function missingColumnFrom<T extends readonly string[]>(error: unknown, columns: T, omitted = new Set<string>()) {
  return columns.find((column) => !omitted.has(column) && isMissingColumnError(error, column));
}

function buildOrderSelect(omitted: Set<string>) {
  return [
    ...REQUIRED_ORDER_COLUMNS,
    ...OPTIONAL_ORDER_COLUMNS.filter((column) => !omitted.has(column)),
  ].join(",");
}

async function fetchOrderWithFallback(externalUrl: string, serviceKey: string, orderId: string) {
  const omitted = new Set<string>();

  while (true) {
    const params = new URLSearchParams({
      id: `eq.${orderId}`,
      select: buildOrderSelect(omitted),
    });
    const res = await fetch(`${externalUrl}/rest/v1/orders?${params.toString()}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const body = await safeJson(res);

    if (!res.ok) {
      const missing = missingColumnFrom(body, OPTIONAL_ORDER_COLUMNS, omitted);
      if (missing) {
        console.warn(`[stripe-connect-refund] orders.${missing} missing, retrying without it`);
        omitted.add(missing);
        continue;
      }
      console.error("[stripe-connect-refund] order fetch failed:", res.status, body);
      throw new Error(typeof (body as any)?.message === "string" ? (body as any).message : "Could not load order");
    }

    const order = Array.isArray(body) ? body[0] : null;
    if (!order) throw new Error("Order not found.");
    return {
      ...order,
      checkout_reference: order.checkout_reference ?? null,
      payment_method: order.payment_method ?? "stripe",
      refunded_at: order.refunded_at ?? null,
      delivered_at: order.delivered_at ?? null,
      shipped_at: order.shipped_at ?? null,
      order_group_id: order.order_group_id ?? null,
      status: order.status ?? null,
    };
  }
}

function stripColumns(body: Record<string, unknown>, stripped: Set<string>) {
  return Object.fromEntries(Object.entries(body).filter(([key]) => !stripped.has(key)));
}

async function patchOrdersWithFallback(
  externalUrl: string,
  serviceKey: string,
  filter: string,
  body: Record<string, unknown>,
) {
  const stripped = new Set<string>();
  let schemaReloaded = false;

  while (true) {
    const res = await fetch(`${externalUrl}/rest/v1/orders?${filter}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(stripColumns(body, stripped)),
    });
    const responseBody = await safeJson(res);
    if (res.ok) return;

    const missing = missingColumnFrom(responseBody, ORDER_UPDATE_FALLBACK_COLUMNS, stripped);
    if (isMissingColumnError(responseBody, "refunded_at") && !schemaReloaded) {
      console.warn("[stripe-connect-refund] orders.refunded_at missing from API schema cache, reloading and retrying");
      schemaReloaded = true;
      await reloadExternalSchemaCache();
      continue;
    }

    if (isMissingColumnError(responseBody, "refunded_at")) {
      throw new Error("Refund was processed but the order could not be marked refunded. Please contact support.");
    }

    if (missing) {
      console.warn(`[stripe-connect-refund] orders.${missing} update column missing, retrying without it`);
      stripped.add(missing);
      continue;
    }

    throw new Error(typeof (responseBody as any)?.message === "string" ? (responseBody as any).message : "Could not update order refund status");
  }
}

async function markRelatedOrdersRefunded(externalUrl: string, serviceKey: string, order: any) {
  const dbUrl = Deno.env.get("EXTERNAL_SUPABASE_DB_URL") ?? Deno.env.get("SUPABASE_DB_URL") ?? "";
  const refundedAt = new Date();
  const refundReason = "seller_refund";

  if (dbUrl) {
    const sql = postgres(dbUrl, { max: 1 });
    try {
      if (order.order_group_id) {
        const groupRows = await sql`
          UPDATE public.orders
          SET refunded_at = ${refundedAt},
              status = 'refunded',
              refund_reason = ${refundReason},
              updated_at = ${refundedAt}
          WHERE order_group_id = ${order.order_group_id}
          RETURNING id
        `;

        if (groupRows.length > 0) return;
      }

      const orderRows = await sql`
        UPDATE public.orders
        SET refunded_at = ${refundedAt},
            status = 'refunded',
            refund_reason = ${refundReason},
            updated_at = ${refundedAt}
        WHERE id = ${order.id}
        RETURNING id
      `;

      if (orderRows.length === 0) {
        throw new Error("No matching order row was updated.");
      }

      return;
    } catch (error) {
      console.error("[stripe-connect-refund] direct refund marker failed:", error);
      throw new Error("Refund was processed but the order could not be marked refunded. Please contact support.");
    } finally {
      await sql.end();
    }
  }

  const body = {
    refunded_at: refundedAt.toISOString(),
    status: "refunded",
    updated_at: refundedAt.toISOString(),
    refund_reason: refundReason,
  };

  if (order.order_group_id) {
    try {
      await patchOrdersWithFallback(externalUrl, serviceKey, `order_group_id=eq.${order.order_group_id}`, body);
      return;
    } catch (error) {
      if (!isMissingColumnError(error, "order_group_id")) {
        console.warn("[stripe-connect-refund] group refund update failed, falling back to order id", error);
      }
    }
  }

  await patchOrdersWithFallback(externalUrl, serviceKey, `id=eq.${order.id}`, body);
}

async function fetchRelatedListingIds(externalUrl: string, serviceKey: string, order: any) {
  if (!order.order_group_id) return [order.listing_id].filter(Boolean);

  const params = new URLSearchParams({
    order_group_id: `eq.${order.order_group_id}`,
    select: "listing_id",
  });
  const res = await fetch(`${externalUrl}/rest/v1/orders?${params.toString()}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const body = await safeJson(res);

  if (!res.ok) return [order.listing_id].filter(Boolean);
  return Array.from(new Set((Array.isArray(body) ? body : []).map((row: any) => row.listing_id).filter(Boolean)));
}

async function markListingsRemoved(externalUrl: string, serviceKey: string, listingIds: string[]) {
  if (!listingIds.length) return;
  const quotedIds = listingIds.map((id) => `"${String(id).replace(/"/g, "")}"`).join(",");
  await fetch(`${externalUrl}/rest/v1/listings?id=in.(${quotedIds})`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status: "removed", updated_at: new Date().toISOString() }),
  });
}

function isDemoOrder(order: any) {
  return order.payment_method === "demo" || (typeof order.checkout_reference === "string" && order.checkout_reference.startsWith("demo-"));
}

function shouldReactivateListings(order: any) {
  return order.status === "awaiting" && !order.shipped_at && !order.delivered_at;
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
    console.warn("[stripe-connect-refund] PaymentIntent search failed, trying recent list", error);
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
    console.warn("[stripe-connect-refund] Checkout Session lookup failed", error);
  }

  throw new Error("Payment reference could not be found for this order. Please contact support.");
}

async function checkRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const url = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) return true;
    const res = await fetch(`${url}/rest/v1/rpc/check_and_record_rate_limit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ _key: key, _max: max, _window_seconds: windowSeconds }),
    });
    if (!res.ok) return true;
    return (await res.json()) === true;
  } catch { return true; }
}

async function insertRefundNotifications(externalUrl: string, serviceKey: string, order: any) {
  try {
    let listingTitle = 'your order';
    if (order.listing_id) {
      const res = await fetch(`${externalUrl}/rest/v1/listings?id=eq.${order.listing_id}&select=title`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.title) listingTitle = rows[0].title;
      }
    }

    const rows = [
      {
        user_id: order.buyer_id,
        type: 'refund_initiated',
        title: 'Refund issued',
        message: `↩️ Your refund for ${listingTitle} has been processed. Funds will return to your original payment method within a few business days.`,
        related_listing_id: order.listing_id ?? null,
        related_user_id: order.seller_id ?? null,
        related_order_id: order.id ?? null,
      },
      {
        user_id: order.seller_id,
        type: 'refund_initiated',
        title: 'Refund issued',
        message: `↩️ You refunded the buyer for ${listingTitle}. The sale has been reversed.`,
        related_listing_id: order.listing_id ?? null,
        related_user_id: order.buyer_id ?? null,
        related_order_id: order.id ?? null,
      },
    ];

    await fetch(`${externalUrl}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
  } catch (error) {
    console.error('[stripe-connect-refund] notification insert failed:', error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    if (!(await checkRateLimit(`stripe-refund:${user.id}`, 10, 3600))) {
      return jsonResponse({ error: "Too many refund attempts. Please try again later." }, 429);
    }

    const { orderId, amount, reason } = await req.json();
    if (!orderId) throw new Error("orderId required");

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!externalUrl || !serviceKey) throw new Error("Payment service is not configured.");

    const order = await fetchOrderWithFallback(externalUrl, serviceKey, orderId);
    if (order.seller_id !== user.id) throw new Error("Only the seller can initiate this refund");
    if (order.refunded_at) throw new Error("Order already refunded");

    // Demo orders (Apple App Review bypass) have no payment intent —
    // just mark refunded directly so reviewers can exercise the refund flow.
    if (isDemoOrder(order)) {
      await markRelatedOrdersRefunded(externalUrl, serviceKey, order);
      return jsonResponse({ success: true, demo: true });
    }

    if (order.payment_method && order.payment_method !== "stripe") {
      throw new Error("Refund only supported for payment processor orders here");
    }


    // Refund window — server-side enforcement. Up to 10 days after delivery,
    // or up to 30 days after order if undelivered. Beyond that, only support
    // can refund (out of band — not via this endpoint).
    const now = Date.now();
    if (order.delivered_at) {
      const deliveredMs = new Date(order.delivered_at).getTime();
      if (now - deliveredMs > 10 * 86400_000) {
        throw new Error("Refund window has closed (10 days after delivery).");
      }
    } else if (order.created_at) {
      const createdMs = new Date(order.created_at).getTime();
      if (now - createdMs > 30 * 86400_000) {
        throw new Error("Refund window has closed (30 days after order).");
      }
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const paymentIntentId = await resolvePaymentIntentId(stripe, order);

    // Idempotency key prevents double-refunds on retry/double-click.
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(typeof amount === "number" && amount > 0
        ? { amount: Math.round(amount * 100) }
        : {}),
      reverse_transfer: true,
      refund_application_fee: true,
      reason: reason === "fraudulent" || reason === "duplicate" ? reason : "requested_by_customer",
      metadata: {
        flea_order_id: orderId,
        flea_seller_id: user.id,
        flea_buyer_id: order.buyer_id,
      },
    }, { idempotencyKey: `flea-refund-${orderId}` });

    await markRelatedOrdersRefunded(externalUrl, serviceKey, order);
    await insertRefundNotifications(externalUrl, serviceKey, order);

    return jsonResponse({ success: true, refundId: refund.id, status: refund.status });
  } catch (error: any) {
    console.error("[stripe-connect-refund] error:", error);
    return jsonResponse({ error: error?.message ?? "Refund failed" }, error?.statusCode || error?.status || 400);
  }
});
