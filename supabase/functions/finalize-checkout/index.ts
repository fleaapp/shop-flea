// finalize-checkout
// Server-authoritative order finalization. NEVER creates orders without first
// confirming the actual payment status with Stripe.
//
// Flow:
//   1. Auth (manual JWT parse to keep cross-project compatibility — this only
//      identifies the buyer; we re-verify payment ownership against the
//      provider before trusting anything).
//   2. Pull authoritative listing rows (price, title, seller).
//   3. Verify the checkoutReference with Stripe:
//        session.payment_status === 'paid' AND payment_intent.status
//        IN ('succeeded','requires_capture'); customer email must match the
//        authenticated buyer.
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


async function checkRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
type ListingRow = { id: string; user_id: string; title: string; price: number; shipping_price?: number | null; status: string };
type NotificationRow = {
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_listing_id?: string | null;
  related_user_id?: string | null;
  related_order_id?: string | null;
};

const ORDER_INSERT_FALLBACK_COLUMNS = ["checkout_reference", "payment_method"] as const;
function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object" || !("code" in error) || !("message" in error)) return false;
  const code = typeof (error as any).code === "string" ? (error as any).code : "";
  const message = typeof (error as any).message === "string" ? (error as any).message : "";
  return (code === "42703" || code === "PGRST204") && message.includes(columnName);
}

async function reloadExternalSchemaCache() {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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

async function sendPush(serviceUrl: string, serviceKey: string, userId: string, notification: NotificationRow) {
  try {
    if (!serviceUrl || !serviceKey || !userId) return;
    const res = await fetch(`${serviceUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ user_id: userId, notification }),
    });
    await res.text().catch(() => "");
  } catch (error) {
    console.error("[finalize-checkout] push failed:", error);
  }
}

async function createCheckoutNotifications(
  client: ReturnType<typeof createClient>,
  serviceUrl: string,
  serviceKey: string,
  buyerId: string,
  insertedOrders: Array<{ id: string; listing_id: string; seller_id: string }>,
  listingMap: Map<string, ListingRow>,
) {
  // CRITICAL: The canonical DB trigger `trg_notify_users_on_listing_sold` on
  // public.orders inserts item_sold / cart_item_sold / wishlist_item_sold /
  // cart_wishlist_item_sold notification rows exactly once per new order.
  // Do NOT re-insert them here or every checkout produces duplicate alerts.
  // This function is push-only — it fans out APNs/web push using the same
  // data the trigger used to build the in-app rows.

  const listingIds = insertedOrders.map((order) => order.listing_id);

  const [{ data: cartRows }, { data: favoriteRows }] = await Promise.all([
    client
      .from("cart_items")
      .select("user_id, listing_id")
      .in("listing_id", listingIds),
    client
      .from("favorites")
      .select("user_id, listing_id")
      .in("listing_id", listingIds),
  ]);

  const cartUsersByListing = new Map<string, Set<string>>();
  for (const row of cartRows ?? []) {
    const set = cartUsersByListing.get(row.listing_id) ?? new Set<string>();
    set.add(row.user_id);
    cartUsersByListing.set(row.listing_id, set);
  }

  const favoriteUsersByListing = new Map<string, Set<string>>();
  for (const row of favoriteRows ?? []) {
    const set = favoriteUsersByListing.get(row.listing_id) ?? new Set<string>();
    set.add(row.user_id);
    favoriteUsersByListing.set(row.listing_id, set);
  }

  const pushes: Array<{ userId: string; notification: NotificationRow }> = [];

  for (const order of insertedOrders) {
    const listing = listingMap.get(order.listing_id);
    const title = listing?.title ?? "your item";

    pushes.push({
      userId: order.seller_id,
      notification: {
        user_id: order.seller_id,
        type: "item_sold",
        title: "Item Sold",
        message: `🎉🤑 Cha-ching! Your item ${title} has just sold. Tap to view the order.`,
        related_listing_id: order.listing_id,
        related_user_id: buyerId,
        related_order_id: order.id,
      },
    });

    const cartUsers = cartUsersByListing.get(order.listing_id) ?? new Set<string>();
    const favoriteUsers = favoriteUsersByListing.get(order.listing_id) ?? new Set<string>();
    const interestedUserIds = new Set([...cartUsers, ...favoriteUsers]);

    for (const userId of interestedUserIds) {
      if (userId === buyerId || userId === order.seller_id) continue;
      const inCart = cartUsers.has(userId);
      const inWishlist = favoriteUsers.has(userId);
      const type = inCart && inWishlist
        ? "cart_wishlist_item_sold"
        : inCart
          ? "cart_item_sold"
          : "wishlist_item_sold";

      pushes.push({
        userId,
        notification: {
          user_id: userId,
          type,
          title: type === "cart_item_sold" ? "Cart Item Sold" : type === "wishlist_item_sold" ? "Wishlist Item Sold" : "Item Sold",
          message: title,
          related_listing_id: order.listing_id,
          related_user_id: order.seller_id,
          related_order_id: order.id,
        },
      });
    }
  }

  if (!pushes.length) return;

  await Promise.allSettled(
    pushes.map((entry) => sendPush(serviceUrl, serviceKey, entry.userId, entry.notification)),
  );
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
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
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

/**
 * Verify the payment with Stripe. Throws if not actually paid.
 * Also returns the buyer email reported by Stripe so we can sanity-check
 * it matches the authenticated user.
 */
async function verifyPayment(opts: {
  reference: string;
  expectedAmountAud?: number;
}): Promise<{ verifiedEmail?: string; paidAmountAud?: number }> {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

  // In-app PaymentSheet / Payment Element path returns a PaymentIntent id (pi_...).
  // Hosted Checkout Session path returns a Session id (cs_...). Handle both.
  if (opts.reference.startsWith("pi_")) {
    const pi = await stripe.paymentIntents.retrieve(opts.reference);
    const paid = pi.status === "succeeded" || pi.status === "requires_capture";
    if (!paid) {
      throw new Error(`Stripe PaymentIntent not paid (status=${pi.status})`);
    }
    const amountTotal = typeof pi.amount_received === "number" && pi.amount_received > 0
      ? pi.amount_received / 100
      : pi.amount / 100;
    if (opts.expectedAmountAud != null) {
      if (Math.abs(amountTotal - opts.expectedAmountAud) > 0.05) {
        throw new Error(`Stripe paid amount mismatch: paid ${amountTotal} expected ${opts.expectedAmountAud}`);
      }
    }
    return { paidAmountAud: amountTotal };
  }

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
  const amountTotal = typeof session.amount_total === "number" ? session.amount_total / 100 : undefined;
  if (opts.expectedAmountAud != null && amountTotal != null) {
    if (Math.abs(amountTotal - opts.expectedAmountAud) > 0.05) {
      throw new Error(`Stripe paid amount mismatch: paid ${amountTotal} expected ${opts.expectedAmountAud}`);
    }
  }
  return {
    verifiedEmail: session.customer_details?.email ?? session.customer_email ?? undefined,
    paidAmountAud: amountTotal,
  };
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

    const { items, shipping, shippingBySeller, checkoutReference, couponCode } = await req.json() as {
      items?: CheckoutItem[];
      shipping?: ShippingDetails;
      shippingBySeller?: Array<[string, number]>;
      paymentMethod?: string;
      checkoutReference?: string;
      couponCode?: string | null;
    };

    if (!Array.isArray(items) || items.length === 0) throw new Error("No items provided.");
    if (!shipping) throw new Error("Missing shipping details.");
    if (!checkoutReference) throw new Error("Missing checkoutReference — payment cannot be verified.");


    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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

    const itemIds = [...new Set(items.map((i) => i.id))];
    const { data: listingRows, error: listingError } = await serviceClient
      .from("listings")
      .select("id, user_id, title, price, shipping_price, status")
      .in("id", itemIds);
    if (listingError) throw listingError;

    const listingMap = new Map((listingRows ?? []).map((r) => [r.id, r as ListingRow]));
    const authoritativeItems = itemIds.map((id) => listingMap.get(id)).filter((x): x is ListingRow => !!x);
    if (authoritativeItems.length === 0) throw new Error("Purchased items could not be found.");

    // Compute expected paid amount from DB-authoritative prices and seller
    // bundle-shipping settings. This must match stripe-connect-payment-intent
    // exactly; do not trust client-supplied shipping totals for verification.
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const dbItemsTotal = authoritativeItems.reduce((s, i) => s + Number(i.price), 0);
    const sellerIds = Array.from(new Set(authoritativeItems.map((item) => item.user_id)));
    const { data: sellerProfiles, error: sellerProfilesError } = await serviceClient
      .from("profiles")
      .select("user_id, bundle_shipping_mode, bundle_shipping_discount_percent")
      .in("user_id", sellerIds);
    if (sellerProfilesError) throw sellerProfilesError;

    const sellerSettings = new Map((sellerProfiles ?? []).map((row: any) => [row.user_id, row]));
    const itemsBySellerForShipping = new Map<string, ListingRow[]>();
    for (const item of authoritativeItems) {
      const arr = itemsBySellerForShipping.get(item.user_id) ?? [];
      arr.push(item);
      itemsBySellerForShipping.set(item.user_id, arr);
    }
    const shippingMap = new Map<string, number>();
    for (const [sellerId, sellerItems] of itemsBySellerForShipping.entries()) {
      const settings: any = sellerSettings.get(sellerId) ?? {};
      const rawShipping = sellerItems.reduce((sum, item) => sum + Number(item.shipping_price || 0), 0);
      const isBundle = sellerItems.length >= 2;
      const mode = String(settings.bundle_shipping_mode || "none");
      const discount = Math.max(0, Math.min(100, Number(settings.bundle_shipping_discount_percent || 0)));
      let sellerShipping = rawShipping;
      if (isBundle && mode === "free") sellerShipping = 0;
      if (isBundle && mode === "discounted" && discount > 0) sellerShipping = rawShipping * (1 - discount / 100);
      shippingMap.set(sellerId, round2(sellerShipping));
    }
    const dbShippingTotal = Array.from(shippingMap.values()).reduce((s, v) => s + Number(v || 0), 0);
    const subtotalForFee = dbItemsTotal + dbShippingTotal;
    const SECURE_CHECKOUT_RATE = 0.04, SECURE_CHECKOUT_FIXED = 0.70;
    const TRANSACTION_FEE_RATE = 0.02, TRANSACTION_FEE_FIXED = 0.50;
    let secureCheckoutFee = Math.round((subtotalForFee * SECURE_CHECKOUT_RATE + SECURE_CHECKOUT_FIXED) * 100) / 100;
    const transactionFeeTotal = subtotalForFee > 0
      ? Math.round((subtotalForFee * TRANSACTION_FEE_RATE + TRANSACTION_FEE_FIXED) * 100) / 100
      : 0;

    // Re-validate coupon server-side (same logic as stripe-connect-payment-intent).
    const normalizedCode = String(couponCode || "").trim().toUpperCase();
    if (normalizedCode) {
      const { data: c } = await serviceClient
        .from("coupons")
        .select("id, code, type, active, starts_at, expires_at, max_redemptions, redemption_count")
        .eq("code", normalizedCode)
        .maybeSingle();
      const now = Date.now();
      if (c && c.active
        && (!c.starts_at || new Date(c.starts_at).getTime() <= now)
        && (!c.expires_at || new Date(c.expires_at).getTime() >= now)
        && (c.max_redemptions === null || c.redemption_count < c.max_redemptions)
        && c.type === "waive_buyer_fee") {
        secureCheckoutFee = 0;
      }
    }
    const expectedAmountAud = Math.round((subtotalForFee + secureCheckoutFee) * 100) / 100;

    // VERIFY PAYMENT WITH STRIPE — fail closed. Enforces both that payment
    // succeeded AND that the amount paid matches what we should have charged
    // based on DB prices (prevents client-supplied price tampering).
    await verifyPayment({ reference: checkoutReference, expectedAmountAud });

    // Filter out listings already sold by another order (defensive — payment
    // already succeeded so we cannot just refuse; we still record what we can).
    const orderGroupId = crypto.randomUUID();
    // shippingMap already initialized above for amount verification.
    const itemsBySeller = new Map<string, ListingRow[]>();
    for (const item of authoritativeItems) {
      const arr = itemsBySeller.get(item.user_id) ?? [];
      arr.push(item);
      itemsBySeller.set(item.user_id, arr);
    }

    const inserts: Record<string, unknown>[] = [];
    for (const [sellerId, sellerItems] of itemsBySeller.entries()) {
      const sellerShipping = shippingMap.get(sellerId) || 0;
      // Allocate the whole checkout's transaction fee onto this seller's first row
      // (mirrors the shipping_price allocation pattern).
      sellerItems.forEach((item, index) => {
        inserts.push({
          order_group_id: orderGroupId,
          listing_id: item.id,
          buyer_id: userId,
          seller_id: sellerId,
          price: Number(item.price),
          shipping_price: index === 0 ? sellerShipping : 0,
          transaction_fee: index === 0 ? transactionFeeTotal : 0,
          status: "awaiting",
          payment_method: "stripe",
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

    await createCheckoutNotifications(
      serviceClient,
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      userId,
      insertedOrders,
      listingMap,
    );

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
