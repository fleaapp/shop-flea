// stripe-connect-refund
// Refund execution for Flea. Supports two modes:
//  - "cascade" (default): full order-group refund. Used by the "Refund sale"
//    button and legacy callers. Reverses the seller transfer and unwinds the
//    buyer's Secure Checkout Fee in one Stripe refund.
//  - "single": per-item partial refund. Used by per-item buyer requests, seller
//    approvals of individual items, admin dispute force-refunds, and the 72h
//    auto-approval cron. Computes pro-rata shipping and fees, refunds only the
//    buyer's share, and reverses only the seller's net share from the Connect
//    transfer.
//
// Approval/decision logic lives in the app and RPCs; this function only handles
// financial execution.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { rejectUntrustedOrigin } from "../_shared/cors.ts";

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
  "transaction_fee",
  "secure_checkout_fee",
  "coupon_code",
] as const;

const ORDER_UPDATE_FALLBACK_COLUMNS = [
  "updated_at",
  "refund_reason",
] as const;

async function reloadExternalSchemaCache() {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
  const filters = [`id=eq.${orderId}`, `order_group_id=eq.${orderId}&order=created_at.asc&limit=1`];
  let filterIdx = 0;

  while (true) {
    const url = `${externalUrl}/rest/v1/orders?${filters[filterIdx]}&select=${encodeURIComponent(buildOrderSelect(omitted))}`;
    const res = await fetch(url, {
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
    if (!order) {
      if (filterIdx < filters.length - 1) {
        filterIdx += 1;
        continue;
      }
      throw new Error("Order not found.");
    }
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

async function markOrderRefunded(externalUrl: string, serviceKey: string, orderId: string) {
  const body = {
    refunded_at: new Date().toISOString(),
    status: "refunded",
    updated_at: new Date().toISOString(),
    refund_reason: "seller_refund",
  };
  await patchOrdersWithFallback(externalUrl, serviceKey, `id=eq.${orderId}`, body);
}

async function markRelatedOrdersRefunded(externalUrl: string, serviceKey: string, order: any) {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") ?? "";
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

async function markListingsRefunded(externalUrl: string, serviceKey: string, listingIds: string[]) {
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
    body: JSON.stringify({ status: "refunded", updated_at: new Date().toISOString() }),
  });
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
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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

// -------------------- Per-item refund helpers --------------------

type BundleMode = "none" | "discounted" | "free";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function calculateSecureCheckoutFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return round2(subtotal * 0.04 + 0.7);
}

function calculateTransactionFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return round2(subtotal * 0.02 + 0.5);
}

function calculateBundleShippingTotal(
  rawShippings: number[],
  mode: BundleMode,
  discountPercent: number | null,
): number {
  if (!rawShippings.length) return 0;
  const subtotal = round2(rawShippings.reduce((sum, s) => sum + (Number(s) || 0), 0));
  if (rawShippings.length < 2) return subtotal;

  if (mode === "free") return 0;
  if (mode === "discounted" && discountPercent) {
    const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    return round2(subtotal * (1 - pct / 100));
  }
  return subtotal;
}

interface RefundBreakdown {
  itemSubtotal: number;
  secureFeeShare: number;
  transactionFeeShare: number;
  buyerRefund: number;
  sellerNet: number;
}

function computeRefundBreakdown(
  targetOrder: any,
  groupRows: any[],
  listings: Map<string, any>,
  bundleMode: BundleMode,
  discountPercent: number | null,
): RefundBreakdown {
  const items = groupRows.map((o) => ({
    orderId: o.id,
    price: Number(o.price) || 0,
    rawShipping: Number(listings.get(o.listing_id)?.shipping_price) || 0,
  }));

  const targetIndex = Math.max(
    0,
    items.findIndex((i) => i.orderId === targetOrder.id),
  );

  const rawShippingTotal = round2(items.reduce((sum, i) => sum + i.rawShipping, 0));
  const bundleShippingTotal = calculateBundleShippingTotal(
    items.map((i) => i.rawShipping),
    bundleMode,
    discountPercent,
  );

  const itemSubtotals = items.map((i) => {
    const share = rawShippingTotal > 0
      ? round2(bundleShippingTotal * (i.rawShipping / rawShippingTotal))
      : 0;
    return round2(i.price + share);
  });

  const groupSubtotal = round2(itemSubtotals.reduce((sum, s) => sum + s, 0));
  const itemSubtotal = itemSubtotals[targetIndex];

  // Use the fees ACTUALLY charged (snapshotted on the order rows at checkout).
  // Recalculating here would refund a Secure Checkout Fee that a coupon waived,
  // i.e. hand back money Flea never collected.
  const savedSecureFee = groupRows.reduce(
    (sum, o) => sum + (Number(o.secure_checkout_fee) || 0), 0);
  const hasSavedSecureFee = groupRows.some((o) => o.secure_checkout_fee !== null && o.secure_checkout_fee !== undefined);
  const savedTransactionFee = groupRows.reduce(
    (sum, o) => sum + (Number(o.transaction_fee) || 0), 0);
  const hasSavedTransactionFee = groupRows.some((o) => o.transaction_fee !== null && o.transaction_fee !== undefined);

  const secureFee = hasSavedSecureFee ? round2(savedSecureFee) : calculateSecureCheckoutFee(groupSubtotal);
  const transactionFee = hasSavedTransactionFee ? round2(savedTransactionFee) : calculateTransactionFee(groupSubtotal);

  const secureFeeShare = groupSubtotal > 0 ? round2(secureFee * (itemSubtotal / groupSubtotal)) : 0;
  const transactionFeeShare = groupSubtotal > 0 ? round2(transactionFee * (itemSubtotal / groupSubtotal)) : 0;

  const buyerRefund = round2(itemSubtotal + secureFeeShare);
  const sellerNet = Math.max(0, round2(itemSubtotal - transactionFeeShare));

  return { itemSubtotal, secureFeeShare, transactionFeeShare, buyerRefund, sellerNet };
}

async function fetchGroupRows(externalUrl: string, serviceKey: string, order: any) {
  if (!order.order_group_id) return [order];
  const res = await fetch(
    `${externalUrl}/rest/v1/orders?order_group_id=eq.${order.order_group_id}&select=id,listing_id,price,shipping_price,secure_checkout_fee,transaction_fee,coupon_code,buyer_id,seller_id,status,refunded_at,created_at,order_group_id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!res.ok) return [order];
  const body = await safeJson(res);
  return Array.isArray(body) && body.length ? body : [order];
}

async function fetchListings(externalUrl: string, serviceKey: string, listingIds: string[]) {
  const map = new Map<string, any>();
  if (!listingIds.length) return map;
  const quoted = listingIds.map((id) => `"${String(id).replace(/"/g, "")}"`).join(",");
  const res = await fetch(`${externalUrl}/rest/v1/listings?id=in.(${quoted})&select=id,shipping_price`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return map;
  const body = await safeJson(res);
  if (!Array.isArray(body)) return map;
  body.forEach((l: any) => map.set(l.id, l));
  return map;
}

async function fetchSellerBundleSettings(externalUrl: string, serviceKey: string, sellerId: string) {
  const res = await fetch(
    `${externalUrl}/rest/v1/profiles?user_id=eq.${sellerId}&select=bundle_shipping_mode,bundle_shipping_discount_percent`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!res.ok) return { mode: "none" as BundleMode, discountPercent: null as number | null };
  const body = await safeJson(res);
  const row = Array.isArray(body) ? body[0] : null;
  return {
    mode: (row?.bundle_shipping_mode as BundleMode) || "none",
    discountPercent: row?.bundle_shipping_discount_percent != null ? Number(row.bundle_shipping_discount_percent) : null,
  };
}

async function createSingleItemRefund(
  stripe: Stripe,
  order: any,
  breakdown: RefundBreakdown,
  actor: string,
): Promise<{ refund: Stripe.Refund; transferReversal?: Stripe.TransferReversal }> {
  const paymentIntentId = await resolvePaymentIntentId(stripe, order);
  const amountCents = Math.round(breakdown.buyerRefund * 100);
  const sellerNetCents = Math.round(breakdown.sellerNet * 100);

  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: amountCents,
      reverse_transfer: false,
      refund_application_fee: false,
      reason: "requested_by_customer",
      metadata: {
        flea_order_id: order.id,
        flea_seller_id: order.seller_id,
        flea_buyer_id: order.buyer_id,
        flea_actor: actor,
        flea_mode: "single",
        flea_buyer_refund_cents: String(amountCents),
        flea_seller_net_cents: String(sellerNetCents),
      },
    },
    { idempotencyKey: `flea-refund-single-${order.id}-${amountCents}` },
  );

  // Reverse only the seller's net share from the Connect transfer.
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = pi.latest_charge as Stripe.Charge | null;
    const transferId = typeof charge?.transfer === "string" ? charge.transfer : charge?.transfer?.id;
    if (transferId && sellerNetCents > 0) {
      const transfer = await stripe.transfers.retrieve(transferId);
      const availableCents = (transfer.amount ?? 0) - (transfer.amount_reversed ?? 0);
      if (availableCents >= sellerNetCents) {
        const reversal = await stripe.transferReversals.create(transferId, {
          amount: sellerNetCents,
          metadata: {
            flea_order_id: order.id,
            flea_refund_id: refund.id,
          },
        }, { idempotencyKey: `flea-reversal-${order.id}-${sellerNetCents}` });
        return { refund, transferReversal: reversal };
      }
      console.warn(
        `[stripe-connect-refund] transfer ${transferId} only has ${availableCents}c available; needed ${sellerNetCents}c`,
      );
    }
  } catch (transferError) {
    console.error("[stripe-connect-refund] transfer reversal failed:", transferError);
    // Continue: the buyer refund succeeded. The seller balance will be handled
    // by the platform ledger and can be settled if needed.
  }

  return { refund };
}

// -------------------- Notifications & chat --------------------

async function insertRefundNotifications(externalUrl: string, serviceKey: string, order: any) {
  try {
    if (order.id) {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const dupRes = await fetch(
        `${externalUrl}/rest/v1/notifications?type=eq.refund_initiated&related_order_id=eq.${order.id}&created_at=gte.${since}&select=id&limit=1`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      );
      if (dupRes.ok) {
        const dupRows = await dupRes.json();
        if (Array.isArray(dupRows) && dupRows.length > 0) {
          console.log("[stripe-connect-refund] refund_initiated already sent for order", order.id);
          return;
        }
      }
    }

    let listingTitle = "your order";
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
        type: "refund_initiated",
        title: "Refund issued",
        message: `↩️ Your refund for ${listingTitle} has been processed. Funds will return to your original payment method within a few business days.`,
        related_listing_id: order.listing_id ?? null,
        related_user_id: order.seller_id ?? null,
        related_order_id: order.id ?? null,
      },
      {
        user_id: order.seller_id,
        type: "refund_initiated",
        title: "Refund issued",
        message: `↩️ You refunded the buyer for ${listingTitle}. The sale has been reversed.`,
        related_listing_id: order.listing_id ?? null,
        related_user_id: order.buyer_id ?? null,
        related_order_id: order.id ?? null,
      },
    ];

    const insertRes = await fetch(`${externalUrl}/rest/v1/notifications`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
    await insertRes.text().catch(() => "");

    if (!insertRes.ok) {
      console.error("[stripe-connect-refund] notification insert failed:", insertRes.status);
      return;
    }

    await Promise.allSettled(rows.map(async (row) => {
      const pushRes = await fetch(`${externalUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ user_id: row.user_id, notification: row }),
      });
      await pushRes.text().catch(() => "");
    }));
  } catch (error) {
    console.error("[stripe-connect-refund] notification insert failed:", error);
  }
}

async function insertRefundInitiatedChatMessage(externalUrl: string, serviceKey: string, order: any) {
  try {
    let sellerUsername: string | null = null;
    if (order.seller_id) {
      const res = await fetch(
        `${externalUrl}/rest/v1/profiles?user_id=eq.${order.seller_id}&select=username`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      );
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.username) sellerUsername = rows[0].username;
      }
    }

    const payload = JSON.stringify({
      type: "refund_initiated",
      seller_username: sellerUsername,
      payment_method: "stripe",
      initiated_at: new Date().toISOString(),
    });

    const rows = [{
      order_id: order.id,
      sender_id: order.seller_id,
      message: payload,
      message_type: "refund_initiated",
    }];

    await fetch(`${externalUrl}/rest/v1/order_messages`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
  } catch (error) {
    console.error("[stripe-connect-refund] chat system message insert failed:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const originBlock = rejectUntrustedOrigin(req);
  if (originBlock) return originBlock;



  try {
    const externalUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!externalUrl || !serviceKey) throw new Error("Payment service is not configured.");

    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const isSystemCaller = bearer && bearer === serviceKey;

    let userId: string | null = null;
    let isAdminCaller = false;

    if (!isSystemCaller) {
      const supabaseClient = createClient(
        externalUrl,
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      userId = user.id;

      const { data: adminRow } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      isAdminCaller = !!adminRow;

      if (!(await checkRateLimit(`stripe-refund:${user.id}`, 10, 3600))) {
        return jsonResponse({ error: "Too many refund attempts. Please try again later." }, 429);
      }
    }

    const body = await req.json().catch(() => ({}));
    const { orderId, reason, mode } = body as { orderId?: string; reason?: string; mode?: "single" | "cascade" };
    if (!orderId) throw new Error("orderId required");

    const order = await fetchOrderWithFallback(externalUrl, serviceKey, orderId);
    if (!isSystemCaller && !isAdminCaller && order.seller_id !== userId) {
      throw new Error("Only the seller can initiate this refund");
    }
    if (order.refunded_at) throw new Error("Order already refunded");

    const refundMode = mode === "single" ? "single" : "cascade";

    // Demo orders (Apple App Review bypass) have no payment intent —
    // just mark refunded directly so reviewers can exercise the refund flow.
    if (isDemoOrder(order)) {
      if (refundMode === "single") {
        await markOrderRefunded(externalUrl, serviceKey, order.id);
        if (order.listing_id) await markListingsRefunded(externalUrl, serviceKey, [order.listing_id]);
      } else {
        await markRelatedOrdersRefunded(externalUrl, serviceKey, order);
        const demoListingIds = await fetchRelatedListingIds(externalUrl, serviceKey, order);
        await markListingsRefunded(externalUrl, serviceKey, demoListingIds);
      }
      await insertRefundNotifications(externalUrl, serviceKey, order);
      await insertRefundInitiatedChatMessage(externalUrl, serviceKey, order);
      return jsonResponse({ success: true, demo: true, mode: refundMode });
    }

    if (order.payment_method && order.payment_method !== "stripe") {
      throw new Error("Refund only supported for payment processor orders here");
    }

    // Refund window — server-side enforcement for seller-initiated refunds.
    // Buyers must request within 48h of delivery (enforced in request_refund),
    // and the seller then has 72h to respond. The outer guard therefore allows
    // delivery + 48h + 72h = 5 days. Admin dispute overrides and system 72h
    // auto-approvals bypass this.
    if (!isSystemCaller && !isAdminCaller && refundMode !== "cascade") {
      const now = Date.now();
      if (order.delivered_at) {
        const deliveredMs = new Date(order.delivered_at).getTime();
        if (now - deliveredMs > 5 * 86400_000) {
          throw new Error("Refund window has closed (48 hours after delivery, plus the seller's 72 hour response window).");
        }
      } else if (order.created_at) {

        const createdMs = new Date(order.created_at).getTime();
        if (now - createdMs > 30 * 86400_000) {
          throw new Error("Refund window has closed (30 days after order).");
        }
      }
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const actor = isSystemCaller ? "system" : isAdminCaller ? "admin" : "seller";

    if (refundMode === "single") {
      const [groupRows, sellerSettings] = await Promise.all([
        fetchGroupRows(externalUrl, serviceKey, order),
        fetchSellerBundleSettings(externalUrl, serviceKey, order.seller_id),
      ]);
      const listingIds = [...new Set(groupRows.map((r) => r.listing_id).filter(Boolean))];
      const listings = await fetchListings(externalUrl, serviceKey, listingIds);
      const breakdown = computeRefundBreakdown(order, groupRows, listings, sellerSettings.mode, sellerSettings.discountPercent);

      const { refund, transferReversal } = await createSingleItemRefund(stripe, order, breakdown, actor);

      await markOrderRefunded(externalUrl, serviceKey, order.id);
      if (order.listing_id) await markListingsRefunded(externalUrl, serviceKey, [order.listing_id]);
      await insertRefundNotifications(externalUrl, serviceKey, order);
      await insertRefundInitiatedChatMessage(externalUrl, serviceKey, order);

      return jsonResponse({
        success: true,
        refundId: refund.id,
        status: refund.status,
        transferReversalId: transferReversal?.id ?? null,
        mode: "single",
        breakdown: {
          itemSubtotal: breakdown.itemSubtotal,
          secureFeeShare: breakdown.secureFeeShare,
          transactionFeeShare: breakdown.transactionFeeShare,
          buyerRefund: breakdown.buyerRefund,
          sellerNet: breakdown.sellerNet,
        },
      });
    }

    // Cascade / full order-group refund.
    const paymentIntentId = await resolvePaymentIntentId(stripe, order);
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reverse_transfer: true,
      refund_application_fee: true,
      reason: reason === "fraudulent" || reason === "duplicate" ? reason : "requested_by_customer",
      metadata: {
        flea_order_id: orderId,
        flea_seller_id: order.seller_id,
        flea_buyer_id: order.buyer_id,
        flea_actor: actor,
        flea_mode: "cascade",
      },
    }, { idempotencyKey: `flea-refund-${orderId}` });

    await markRelatedOrdersRefunded(externalUrl, serviceKey, order);
    const relatedListingIds = await fetchRelatedListingIds(externalUrl, serviceKey, order);
    await markListingsRefunded(externalUrl, serviceKey, relatedListingIds);
    await insertRefundNotifications(externalUrl, serviceKey, order);
    await insertRefundInitiatedChatMessage(externalUrl, serviceKey, order);

    return jsonResponse({ success: true, refundId: refund.id, status: refund.status, mode: "cascade" });
  } catch (error: any) {
    console.error("[stripe-connect-refund] error:", error);
    return jsonResponse({ error: error?.message ?? "Refund failed" }, error?.statusCode || error?.status || 400);
  }
});
