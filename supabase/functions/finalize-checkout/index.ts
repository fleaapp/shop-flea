import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CheckoutItem = {
  id: string;
  sellerId: string;
  price: number;
};

type ShippingDetails = {
  shippingFirstName?: string;
  shippingLastName?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostcode?: string;
};

type ListingRow = {
  id: string;
  user_id: string;
  title: string;
  price: number;
  status: string;
};

const ORDER_INSERT_FALLBACK_COLUMNS = ["checkout_reference", "payment_method"] as const;

function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object" || !("code" in error) || !("message" in error)) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const message = typeof error.message === "string" ? error.message : "";

  return (code === "42703" || code === "PGRST204") && message.includes(columnName);
}

async function reloadExternalSchemaCache() {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) return;

    await fetch(`${supabaseUrl}/functions/v1/reload-schema`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
    });
  } catch (error) {
    console.error("[finalize-checkout] Schema reload trigger failed:", error);
  }
}

function stripOrderColumns(
  rows: Record<string, unknown>[],
  columnsToStrip: Set<string>,
): Record<string, unknown>[] {
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([key]) => !columnsToStrip.has(key)))
  );
}

async function insertOrdersWithFallback(
  serviceClient: ReturnType<typeof createClient>,
  rows: Record<string, unknown>[],
) {
  const strippedColumns = new Set<string>();
  let schemaReloaded = false;

  while (true) {
    const payload = stripOrderColumns(rows, strippedColumns);
    const result = await serviceClient
      .from("orders")
      .insert(payload)
      .select("id, listing_id, seller_id");

    const missingColumn = ORDER_INSERT_FALLBACK_COLUMNS.find(
      (column) => !strippedColumns.has(column) && isMissingColumnError(result.error, column),
    );

    if (!missingColumn) {
      return result;
    }

    if (!schemaReloaded) {
      console.warn(`[finalize-checkout] ${missingColumn} unavailable in schema cache during insert, reloading schema and retrying.`);
      schemaReloaded = true;
      await reloadExternalSchemaCache();
      continue;
    }

    console.warn(`[finalize-checkout] ${missingColumn} still unavailable after schema reload, retrying without it.`);
    strippedColumns.add(missingColumn);
  }
}

async function sendPushNotification(userId: string, notification: Record<string, unknown>) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return;

    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ user_id: userId, notification }),
    });
  } catch (error) {
    console.error("[finalize-checkout] Push send failed:", error);
  }
}

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { sub?: string; exp?: number };
    if (!payload.sub) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = getUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { items, shipping, shippingBySeller, paymentMethod, checkoutReference } = await req.json() as {
      items?: CheckoutItem[];
      shipping?: ShippingDetails;
      shippingBySeller?: Array<[string, number]>;
      paymentMethod?: string;
      checkoutReference?: string;
    };

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No items provided.");
    }

    if (!shipping) {
      throw new Error("Missing shipping details.");
    }

    const serviceClient = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const itemIds = [...new Set(items.map((item: CheckoutItem) => item.id))];

    const { data: listingRows, error: listingError } = await serviceClient
      .from("listings")
      .select("id, user_id, title, price, status")
      .in("id", itemIds);

    if (listingError) throw listingError;

    const listingMap = new Map((listingRows ?? []).map((row) => [row.id, row as ListingRow]));
    const authoritativeItems = itemIds
      .map((id) => listingMap.get(id))
      .filter((item): item is ListingRow => !!item);

    if (authoritativeItems.length === 0) {
      throw new Error("Purchased items could not be found.");
    }

    let existingOrdersQuery = serviceClient
      .from("orders")
      .select("id, listing_id, seller_id")
      .eq("buyer_id", userId)
      .in("listing_id", itemIds);

    if (checkoutReference) {
      existingOrdersQuery = existingOrdersQuery.eq("checkout_reference", checkoutReference);
    }

    let existingOrdersResult = await existingOrdersQuery;
    if (checkoutReference && isMissingColumnError(existingOrdersResult.error, "checkout_reference")) {
      console.warn("[finalize-checkout] checkout_reference unavailable in schema cache during lookup, retrying without it.");
      existingOrdersResult = await serviceClient
        .from("orders")
        .select("id, listing_id, seller_id")
        .eq("buyer_id", userId)
        .in("listing_id", itemIds);
    }

    if (existingOrdersResult.error) throw existingOrdersResult.error;

    const existingOrders = existingOrdersResult.data ?? [];
    const existingListingIds = new Set(existingOrders.map((order) => order.listing_id));

    if (existingOrders && existingOrders.length === itemIds.length) {
      await serviceClient
        .from("listings")
        .update({ status: "sold", updated_at: new Date().toISOString() })
        .in("id", itemIds);

      await serviceClient
        .from("cart_items")
        .delete()
        .eq("user_id", userId)
        .in("listing_id", itemIds);

      return new Response(JSON.stringify({ ok: true, alreadyProcessed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pendingItems = authoritativeItems.filter((item) => !existingListingIds.has(item.id));

    if (pendingItems.length === 0) {
      return new Response(JSON.stringify({ ok: true, alreadyProcessed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderGroupId = crypto.randomUUID();
    const shippingMap = new Map<string, number>(Array.isArray(shippingBySeller) ? shippingBySeller : []);
    const itemsBySeller = new Map<string, ListingRow[]>();

    for (const item of pendingItems) {
      const sellerItems = itemsBySeller.get(item.user_id) ?? [];
      sellerItems.push(item);
      itemsBySeller.set(item.user_id, sellerItems);
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
          ...(checkoutReference ? { checkout_reference: checkoutReference } : {}),
        });
      });
    }

    const insertResult = await insertOrdersWithFallback(serviceClient, inserts);

    if (insertResult.error) throw insertResult.error;

    const insertedOrders = insertResult.data ?? [];

    await serviceClient
      .from("listings")
      .update({ status: "sold", updated_at: new Date().toISOString() })
      .in("id", itemIds);

    const [cartUsersResult, wishlistUsersResult] = await Promise.all([
      serviceClient
        .from("cart_items")
        .select("listing_id, user_id")
        .in("listing_id", itemIds),
      serviceClient
        .from("favorites")
        .select("listing_id, user_id")
        .in("listing_id", itemIds),
    ]);

    if (cartUsersResult.error) throw cartUsersResult.error;
    if (wishlistUsersResult.error) throw wishlistUsersResult.error;

    const cartUsersByListing = new Map<string, Set<string>>();
    for (const row of cartUsersResult.data ?? []) {
      const users = cartUsersByListing.get(row.listing_id) ?? new Set<string>();
      users.add(row.user_id);
      cartUsersByListing.set(row.listing_id, users);
    }

    const wishlistUsersByListing = new Map<string, Set<string>>();
    for (const row of wishlistUsersResult.data ?? []) {
      const users = wishlistUsersByListing.get(row.listing_id) ?? new Set<string>();
      users.add(row.user_id);
      wishlistUsersByListing.set(row.listing_id, users);
    }

    const notificationRows: Record<string, unknown>[] = [];

    for (const order of insertedOrders ?? []) {
      const listing = listingMap.get(order.listing_id);
      if (!listing) continue;

      notificationRows.push({
        user_id: order.seller_id,
        type: "item_sold",
        title: "Item Sold",
        message: listing.title,
        related_listing_id: order.listing_id,
        related_user_id: userId,
        related_order_id: order.id,
      });

      await sendPushNotification(order.seller_id, {
        type: "item_sold",
        title: "Item Sold",
        message: `🎉🤑 Cha-ching! Your item \"${listing.title}\" has just sold.`,
        related_listing_id: order.listing_id,
        related_order_id: order.id,
      });

      const cartUsers = cartUsersByListing.get(order.listing_id) ?? new Set<string>();
      const wishlistUsers = wishlistUsersByListing.get(order.listing_id) ?? new Set<string>();

      for (const watcherId of new Set([...cartUsers, ...wishlistUsers])) {
        if (watcherId === userId || watcherId === order.seller_id) continue;

        const inCart = cartUsers.has(watcherId);
        const inWishlist = wishlistUsers.has(watcherId);
        const type = inCart && inWishlist
          ? "cart_wishlist_item_sold"
          : inCart
            ? "cart_item_sold"
            : "wishlist_item_sold";

        notificationRows.push({
          user_id: watcherId,
          type,
          title: "Item Sold",
          message: listing.title,
          related_listing_id: order.listing_id,
          related_user_id: userId,
        });

        await sendPushNotification(watcherId, {
          type,
          title: "Item Sold",
          message: `${listing.title}.`,
          related_listing_id: order.listing_id,
        });
      }
    }

    if (notificationRows.length > 0) {
      const { error: notificationError } = await serviceClient
        .from("notifications")
        .insert(notificationRows);

      if (notificationError) throw notificationError;
    }

    const { error: clearCartError } = await serviceClient
      .from("cart_items")
      .delete()
      .eq("user_id", userId)
      .in("listing_id", itemIds);

    if (clearCartError) throw clearCartError;

    return new Response(JSON.stringify({ ok: true, alreadyProcessed: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[finalize-checkout] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});