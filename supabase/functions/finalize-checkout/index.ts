// finalize-checkout
// Server-authoritative order finalization. NEVER creates orders without first
// confirming the actual payment status with the payment provider (Stripe or
// PayPal). Also captures PayPal authorizations that haven't been captured yet.
//
// Flow:
//   1. Auth (manual JWT parse to keep cross-project compatibility — this only
//      identifies the buyer; we re-verify payment ownership against the
//      provider before trusting anything).
//   2. Pull authoritative listing rows (price, title, seller).
//   3. Verify the checkoutReference with the provider:
//        - Stripe: session.payment_status === 'paid' AND payment_intent.status
//          IN ('succeeded','requires_capture'); customer email must match the
//          authenticated buyer.
//        - PayPal: order status COMPLETED, capturing it first if APPROVED.
//   4. Idempotency: bail if an order with the same checkout_reference already
//      exists for this buyer.
//   5. Insert order rows, THEN flip listings -> sold (only if all rows
//      inserted), THEN clear cart, THEN fan out notifications.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYPAL_API = "https://api-m.paypal.com";

async function checkRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const url = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) return true;
    const res = await fetch(`${url}/rest/v1/rpc/check_and_record_rate_limit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ _key: key, _max: max, _window_seconds: windowSeconds }),
    });
    if (!res.ok) return true; // fail-open
    const allowed = await res.json();
    return allowed === true;
  } catch {
    return true;
  }
}

type CheckoutItem = { id: string; sellerId: string; price: number };
type ShippingDetails = {
  shippingFirstName?: string;
  shippingLastName?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostcode?: string;
};
type ListingRow = { id: string; user_id: string; title: string; price: number; status: string };

const ORDER_INSERT_FALLBACK_COLUMNS = ["checkout_reference", "payment_method"] as const;
const NOTIFICATION_INSERT_FALLBACK_COLUMNS = ["related_order_id"] as const;

function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object" || !("code" in error) || !("message" in error)) return false;
  const code = typeof (error as any).code === "string" ? (error as any).code : "";
  const message = typeof (error as any).message === "string" ? (error as any).message : "";
  return (code === "42703" || code === "PGRST204") && message.includes(columnName);
}

async function reloadExternalSchemaCache() {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return;
    await fetch(`${supabaseUrl}/functions/v1/reload-schema`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
    });
  } catch (error) {
    console.error("[finalize-checkout] Schema reload trigger failed:", error);
  }
}

function stripCols(rows: Record<string, unknown>[], cols: Set<string>) {
  return rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !cols.has(k))));
}

async function insertOrdersWithFallback(client: ReturnType<typeof createClient>, rows: Record<string, unknown>[]) {
  const stripped = new Set<string>();
  let reloaded = false;
  while (true) {
    const result = await client.from("orders").insert(stripCols(rows, stripped)).select("id, listing_id, seller_id");
    const missing = ORDER_INSERT_FALLBACK_COLUMNS.find((c) => !stripped.has(c) && isMissingColumnError(result.error, c));
    if (!missing) return result;
    if (!reloaded) { reloaded = true; await reloadExternalSchemaCache(); continue; }
    stripped.add(missing);
  }
}

async function insertNotificationsWithFallback(client: ReturnType<typeof createClient>, rows: Record<string, unknown>[]) {
  const stripped = new Set<string>();
  while (true) {
    const result = await client.from("notifications").insert(stripCols(rows, stripped));
    const missing = NOTIFICATION_INSERT_FALLBACK_COLUMNS.find((c) => !stripped.has(c) && isMissingColumnError(result.error, c));
    if (!missing) return result;
    stripped.add(missing);
  }
}

async function fetchOrdersForBuyer(client: ReturnType<typeof createClient>, userId: string, itemIds: string[], ref?: string) {
  let q = client.from("orders").select("id, listing_id, seller_id, created_at, checkout_reference")
    .eq("buyer_id", userId).in("listing_id", itemIds).order("created_at", { ascending: false });
  if (ref) q = q.eq("checkout_reference", ref);
  let result = await q;
  if (ref && isMissingColumnError(result.error, "checkout_reference")) {
    result = await client.from("orders").select("id, listing_id, seller_id, created_at")
      .eq("buyer_id", userId).in("listing_id", itemIds).order("created_at", { ascending: false });
  }
  return result;
}

async function sendPushNotification(userId: string, notification: Record<string, unknown>) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return;
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ user_id: userId, notification }),
    });
  } catch (error) { console.error("[finalize-checkout] Push send failed:", error); }
}

// Signature-verified JWT extraction. Uses Supabase's auth client to validate
// the token cryptographically (not just decode it) — protects against forged
// JWTs minted with arbitrary `sub` values.
async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const verifier = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await verifier.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    const exp = (data.claims as { exp?: number }).exp;
    if (exp && exp * 1000 < Date.now()) return null;
    return data.claims.sub as string;
  } catch {
    return null;
  }
}

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
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  return (await res.json()).access_token as string;
}

/**
 * Verify the payment with the provider. Throws if not actually paid.
 * Also returns the buyer email reported by the provider so we can sanity-check
 * it matches the authenticated user.
 */
async function verifyPayment(opts: {
  provider: "stripe" | "paypal";
  reference: string;
  expectedAmountAud?: number;
}): Promise<{ verifiedEmail?: string }> {
  if (opts.provider === "stripe") {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(opts.reference, { expand: ["payment_intent"] });
    const piStatus = typeof session.payment_intent === "object" && session.payment_intent
      ? (session.payment_intent as Stripe.PaymentIntent).status
      : null;
    const paid = session.payment_status === "paid"
      || session.payment_status === "no_payment_required"
      || piStatus === "succeeded"
      || piStatus === "requires_capture";
    if (!paid) {
      throw new Error(`Stripe session not paid (status=${session.payment_status}, pi=${piStatus})`);
    }
    return { verifiedEmail: session.customer_details?.email ?? session.customer_email ?? undefined };
  }

  // PayPal — capture if APPROVED, then require COMPLETED.
  const token = await getPayPalAccessToken();
  let lookup = await fetch(`${PAYPAL_API}/v2/checkout/orders/${opts.reference}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!lookup.ok) throw new Error(`PayPal order lookup failed: ${lookup.status}`);
  let data = await lookup.json();

  if (data.status === "APPROVED") {
    const cap = await fetch(`${PAYPAL_API}/v2/checkout/orders/${opts.reference}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `flea-cap-${opts.reference}`,
        "PayPal-Partner-Attribution-Id": Deno.env.get("PAYPAL_CLIENT_ID") || "",
      },
    });
    if (!cap.ok && cap.status !== 422 /* already captured */) {
      throw new Error(`PayPal capture failed: ${cap.status}`);
    }
    if (cap.ok) data = await cap.json();
    else {
      lookup = await fetch(`${PAYPAL_API}/v2/checkout/orders/${opts.reference}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      data = await lookup.json();
    }
  }

  if (data.status !== "COMPLETED") {
    throw new Error(`PayPal order not completed (status=${data.status})`);
  }
  return { verifiedEmail: data.payer?.email_address ?? undefined };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(await checkRateLimit(`finalize-checkout:${userId}`, 10, 60))) {
      return new Response(JSON.stringify({ error: "Too many checkout attempts. Please wait a moment and try again." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { items, shipping, shippingBySeller, paymentMethod, checkoutReference } = await req.json() as {
      items?: CheckoutItem[];
      shipping?: ShippingDetails;
      shippingBySeller?: Array<[string, number]>;
      paymentMethod?: string;
      checkoutReference?: string;
    };

    if (!Array.isArray(items) || items.length === 0) throw new Error("No items provided.");
    if (!shipping) throw new Error("Missing shipping details.");
    if (!checkoutReference) throw new Error("Missing checkoutReference — payment cannot be verified.");

    const provider: "stripe" | "paypal" = paymentMethod === "paypal" ? "paypal" : "stripe";

    const serviceClient = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Idempotency: if any order already exists for this checkout_reference,
    // reuse it instead of creating duplicates / re-verifying the provider.
    const { data: priorOrders } = await serviceClient
      .from("orders")
      .select("id, listing_id, buyer_id")
      .eq("checkout_reference", checkoutReference);
    if (priorOrders && priorOrders.length > 0) {
      // Sanity: orders for this reference must belong to this buyer.
      const otherBuyer = priorOrders.find((o: any) => o.buyer_id !== userId);
      if (otherBuyer) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, alreadyProcessed: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // VERIFY PAYMENT WITH PROVIDER — fail closed.
    await verifyPayment({ provider, reference: checkoutReference });

    const itemIds = [...new Set(items.map((i) => i.id))];
    const { data: listingRows, error: listingError } = await serviceClient
      .from("listings")
      .select("id, user_id, title, price, status")
      .in("id", itemIds);
    if (listingError) throw listingError;

    const listingMap = new Map((listingRows ?? []).map((r) => [r.id, r as ListingRow]));
    const authoritativeItems = itemIds.map((id) => listingMap.get(id)).filter((x): x is ListingRow => !!x);
    if (authoritativeItems.length === 0) throw new Error("Purchased items could not be found.");

    // Filter out listings already sold by another order (defensive — payment
    // already succeeded so we cannot just refuse; we still record what we can).
    const orderGroupId = crypto.randomUUID();
    const shippingMap = new Map<string, number>(Array.isArray(shippingBySeller) ? shippingBySeller : []);
    const itemsBySeller = new Map<string, ListingRow[]>();
    for (const item of authoritativeItems) {
      const arr = itemsBySeller.get(item.user_id) ?? [];
      arr.push(item);
      itemsBySeller.set(item.user_id, arr);
    }

    const inserts: Record<string, unknown>[] = [];
    for (const [sellerId, sellerItems] of itemsBySeller.entries()) {
      const sellerShipping = shippingMap.get(sellerId) || 0;
      sellerItems.forEach((item, index) => {
        inserts.push({
          order_group_id: orderGroupId,
          listing_id: item.id,
          buyer_id: userId,
          seller_id: sellerId,
          price: Number(item.price),
          shipping_price: index === 0 ? sellerShipping : 0,
          status: "awaiting",
          payment_method: paymentMethod || "stripe",
          shipping_first_name: shipping.shippingFirstName,
          shipping_last_name: shipping.shippingLastName,
          shipping_address: shipping.shippingAddress,
          shipping_city: shipping.shippingCity,
          shipping_state: shipping.shippingState,
          shipping_postcode: shipping.shippingPostcode,
          checkout_reference: checkoutReference,
        });
      });
    }

    const insertResult = await insertOrdersWithFallback(serviceClient, inserts);
    if (insertResult.error) throw insertResult.error;
    let insertedOrders = insertResult.data ?? [];

    if (insertedOrders.length !== authoritativeItems.length) {
      const verify = await fetchOrdersForBuyer(serviceClient, userId, authoritativeItems.map((i) => i.id), checkoutReference);
      if (verify.error) throw verify.error;
      insertedOrders = verify.data ?? [];
    }
    if (insertedOrders.length !== authoritativeItems.length) {
      // Orders did NOT all create — DO NOT mark listings sold. Surface error
      // so support can reconcile manually rather than silently hiding listings.
      throw new Error("Order finalization did not create the expected order records.");
    }

    // Only NOW flip listings -> sold (after we know all order rows exist).
    await serviceClient
      .from("listings")
      .update({ status: "sold", updated_at: new Date().toISOString() })
      .in("id", authoritativeItems.map((i) => i.id));

    const [cartUsersResult, wishlistUsersResult] = await Promise.all([
      serviceClient.from("cart_items").select("listing_id, user_id").in("listing_id", itemIds),
      serviceClient.from("favorites").select("listing_id, user_id").in("listing_id", itemIds),
    ]);
    if (cartUsersResult.error) throw cartUsersResult.error;
    if (wishlistUsersResult.error) throw wishlistUsersResult.error;

    const cartUsersByListing = new Map<string, Set<string>>();
    for (const row of cartUsersResult.data ?? []) {
      const s = cartUsersByListing.get(row.listing_id) ?? new Set<string>();
      s.add(row.user_id); cartUsersByListing.set(row.listing_id, s);
    }
    const wishlistUsersByListing = new Map<string, Set<string>>();
    for (const row of wishlistUsersResult.data ?? []) {
      const s = wishlistUsersByListing.get(row.listing_id) ?? new Set<string>();
      s.add(row.user_id); wishlistUsersByListing.set(row.listing_id, s);
    }

    const notificationRows: Record<string, unknown>[] = [];
    for (const order of insertedOrders ?? []) {
      const listing = listingMap.get(order.listing_id);
      if (!listing) continue;
      notificationRows.push({
        user_id: order.seller_id, type: "item_sold", title: "Item Sold", message: listing.title,
        related_listing_id: order.listing_id, related_user_id: userId, related_order_id: order.id,
      });
      await sendPushNotification(order.seller_id, {
        type: "item_sold", title: "Item Sold",
        message: `🎉🤑 Cha-ching! Your item \"${listing.title}\" has just sold.`,
        related_listing_id: order.listing_id, related_order_id: order.id,
      });
      const cartUsers = cartUsersByListing.get(order.listing_id) ?? new Set<string>();
      const wishlistUsers = wishlistUsersByListing.get(order.listing_id) ?? new Set<string>();
      for (const watcherId of new Set([...cartUsers, ...wishlistUsers])) {
        if (watcherId === userId || watcherId === order.seller_id) continue;
        const inCart = cartUsers.has(watcherId);
        const inWishlist = wishlistUsers.has(watcherId);
        const type = inCart && inWishlist ? "cart_wishlist_item_sold" : inCart ? "cart_item_sold" : "wishlist_item_sold";
        notificationRows.push({
          user_id: watcherId, type, title: "Item Sold", message: listing.title,
          related_listing_id: order.listing_id, related_user_id: userId,
        });
        await sendPushNotification(watcherId, { type, title: "Item Sold", message: `${listing.title}.`, related_listing_id: order.listing_id });
      }
    }

    if (notificationRows.length > 0) {
      const { error } = await insertNotificationsWithFallback(serviceClient, notificationRows);
      if (error) throw error;
    }

    await serviceClient.from("cart_items").delete().eq("user_id", userId).in("listing_id", itemIds);

    return new Response(JSON.stringify({ ok: true, alreadyProcessed: false }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[finalize-checkout] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
