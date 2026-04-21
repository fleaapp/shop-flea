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

    const { items, shipping, shippingBySeller, paymentMethod, checkoutReference } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No items provided.");
    }

    if (!shipping || !checkoutReference) {
      throw new Error("Missing shipping details or checkout reference.");
    }

    const serviceClient = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const itemIds = items.map((item: CheckoutItem) => item.id);

    const { data: existingOrders, error: existingOrdersError } = await serviceClient
      .from("orders")
      .select("id, listing_id")
      .eq("checkout_reference", checkoutReference)
      .in("listing_id", itemIds);

    if (existingOrdersError) throw existingOrdersError;

    const existingListingIds = new Set((existingOrders ?? []).map((order) => order.listing_id));

    if (existingOrders && existingOrders.length === itemIds.length) {
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

    const pendingItems = (items as CheckoutItem[]).filter((item) => !existingListingIds.has(item.id));

    if (pendingItems.length === 0) {
      return new Response(JSON.stringify({ ok: true, alreadyProcessed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderGroupId = crypto.randomUUID();
    const shippingMap = new Map<string, number>(Array.isArray(shippingBySeller) ? shippingBySeller : []);
    const itemsBySeller = new Map<string, CheckoutItem[]>();

    for (const item of pendingItems) {
      const sellerItems = itemsBySeller.get(item.sellerId) ?? [];
      sellerItems.push(item);
      itemsBySeller.set(item.sellerId, sellerItems);
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
          price: item.price,
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

    const { data: insertedOrders, error: insertError } = await serviceClient
      .from("orders")
      .insert(inserts)
      .select("id, listing_id, seller_id");
    if (insertError) throw insertError;

    const { data: listingRows } = await serviceClient
      .from("listings")
      .select("id, title")
      .in("id", itemIds);

    const listingTitleMap = new Map((listingRows ?? []).map((row) => [row.id, row.title]));

    for (const order of insertedOrders ?? []) {
      await sendPushNotification(order.seller_id, {
        type: "item_sold",
        title: "Item Sold",
        message: `🎉🤑 Cha-ching! Your item \"${listingTitleMap.get(order.listing_id) ?? 'item'}\" has just sold!`,
        related_listing_id: order.listing_id,
        related_order_id: order.id,
      });
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