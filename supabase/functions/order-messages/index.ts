import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type NotificationInsert = {
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_listing_id: string | null;
  related_user_id: string;
  related_order_id?: string;
  related_thread_id?: string;
};

const EXTERNAL_PUBLIC_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "https://dzglehiopfgfjmxtejve.supabase.co";
const EXTERNAL_PUBLIC_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z2xlaGlvcGZnZmpteHRlanZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzI0MjUsImV4cCI6MjA4NDU0ODQyNX0.qfOBjubnuod5iGF_G_gH2ZhMDJ1fVwAO9p5BZSxG0xI";
const EXTERNAL_SERVICE_ROLE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

function getExternalClient(authHeader?: string | null) {
  return createClient(EXTERNAL_PUBLIC_URL, EXTERNAL_PUBLIC_ANON_KEY, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

function getExternalServiceClient(authHeader?: string | null) {
  // Use service role key for server-side operations to bypass RLS
  if (EXTERNAL_SERVICE_ROLE_KEY) {
    return createClient(EXTERNAL_PUBLIC_URL, EXTERNAL_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return getExternalClient(authHeader);
}

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

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

type ExternalClient = ReturnType<typeof getExternalClient>;

let orderMessageKeyCache: "order_id" | "order_group_id" | null = null;

async function getOrderMessageKey(
  extClient: ExternalClient,
): Promise<"order_id" | "order_group_id"> {
  if (orderMessageKeyCache) return orderMessageKeyCache;

  const orderIdProbe = await extClient
    .from("order_messages")
    .select("order_id")
    .limit(1);

  if (!orderIdProbe.error) {
    orderMessageKeyCache = "order_id";
    return orderMessageKeyCache;
  }

  const orderGroupIdProbe = await extClient
    .from("order_messages")
    .select("order_group_id")
    .limit(1);

  if (!orderGroupIdProbe.error) {
    orderMessageKeyCache = "order_group_id";
    return orderMessageKeyCache;
  }

  throw orderIdProbe.error ?? orderGroupIdProbe.error ?? new Error("Unable to determine order message key");
}

async function isOrderParticipant(
  userId: string,
  requestedOrderId: string,
  authHeader?: string | null,
): Promise<{
  isBuyer: boolean;
  isSeller: boolean;
  deliveredAt: string | null;
  buyerId: string;
  sellerId: string;
  listingId: string;
  paymentMethod: string;
  matchedOrderId: string | null;
  matchedOrderGroupId: string | null;
  relatedOrderIds: string[];
  requestedIdType: "order" | "group" | "unknown";
}> {
  const extClient = getExternalServiceClient(authHeader);
  const emptyState = {
    isBuyer: false,
    isSeller: false,
    deliveredAt: null,
    buyerId: "",
    sellerId: "",
    listingId: "",
    paymentMethod: "stripe",
    matchedOrderId: null,
    matchedOrderGroupId: null,
    relatedOrderIds: [],
    requestedIdType: "unknown" as const,
  };

  const orderByIdResponse = await extClient
    .from("orders")
    .select("id, order_group_id, buyer_id, seller_id, delivered_at, listing_id, payment_method")
    .eq("id", requestedOrderId)
    .maybeSingle();

  let order = orderByIdResponse.data;
  let requestedIdType: "order" | "group" | "unknown" = "order";

  if (!order) {
    requestedIdType = "group";
    const orderByGroupResponse = await extClient
      .from("orders")
      .select("id, order_group_id, buyer_id, seller_id, delivered_at, listing_id, payment_method")
      .eq("order_group_id", requestedOrderId)
      .order("created_at", { ascending: true })
      .limit(1);

    order = orderByGroupResponse.data?.[0] ?? null;
  }

  if (!order) return emptyState;

  let relatedOrderIds = [order.id];
  if (order.order_group_id) {
    const { data: groupedOrders } = await extClient
      .from("orders")
      .select("id")
      .eq("order_group_id", order.order_group_id);

    if (groupedOrders?.length) {
      relatedOrderIds = groupedOrders.map((groupedOrder) => groupedOrder.id);
    }
  }

  return {
    isBuyer: order.buyer_id === userId,
    isSeller: order.seller_id === userId,
    deliveredAt: order.delivered_at,
    buyerId: order.buyer_id,
    sellerId: order.seller_id,
    listingId: order.listing_id,
    paymentMethod: order.payment_method || "stripe",
    matchedOrderId: order.id,
    matchedOrderGroupId: order.order_group_id,
    relatedOrderIds,
    requestedIdType,
  };
}

async function getUsername(userId: string, authHeader?: string | null): Promise<string> {
  const extClient = getExternalServiceClient(authHeader);

  const publicProfileResponse = await extClient
    .from("profiles_public")
    .select("username")
    .eq("user_id", userId)
    .maybeSingle();

  if (publicProfileResponse.data?.username) {
    return publicProfileResponse.data.username;
  }

  const profileResponse = await extClient
    .from("profiles")
    .select("username")
    .eq("user_id", userId)
    .maybeSingle();

  return profileResponse.data?.username ?? "user";
}

async function insertNotificationWithFallback(
  extClient: ExternalClient,
  payload: NotificationInsert,
) {
  const { error } = await extClient.from("notifications").insert(payload);
  if (!error) return;

  const errorText = `${error.message ?? ""} ${error.details ?? ""}`;
  const missingOptionalColumn =
    error.code === "PGRST204" ||
    errorText.includes("related_order_id") ||
    errorText.includes("related_thread_id");

  if (!missingOptionalColumn) throw error;

  const fallbackPayload = {
    user_id: payload.user_id,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    related_listing_id: payload.related_listing_id,
    related_user_id: payload.related_user_id,
  };

  const { error: fallbackError } = await extClient
    .from("notifications")
    .insert(fallbackPayload);

  if (fallbackError) throw fallbackError;
}

async function insertSystemMessage(
  extClient: ExternalClient,
  orderMessageKey: "order_id" | "order_group_id",
  orderId: string,
  senderId: string,
  messageType: string,
  message: string,
  attachmentUrl?: string | null,
) {
  const baseInsert = {
    sender_id: senderId,
    message: message || "",
    attachment_url: attachmentUrl || null,
    message_type: messageType,
  };

  const messageInsert = orderMessageKey === "order_id"
    ? { ...baseInsert, order_id: orderId }
    : { ...baseInsert, order_group_id: orderId };

  const { data, error } = await extClient
    .from("order_messages")
    .insert(messageInsert)
    .select()
    .single();

  if (error) throw error;
  return data;
}

function formatUsername(username: string): string {
  return username.startsWith("@") ? username : `@${username}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[order-messages] Request:", req.method, req.url);
    const userId = await getUserId(req);
    console.log("[order-messages] userId:", userId);
    console.log("[order-messages] Has service role key:", !!EXTERNAL_SERVICE_ROLE_KEY);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    const action = url.searchParams.get("action");

    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const orderInfo = await isOrderParticipant(userId, orderId, authHeader);
    const { isBuyer, isSeller, deliveredAt } = orderInfo;
    if (!isBuyer && !isSeller) {
      return new Response(JSON.stringify({ error: "Not a participant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const external = getExternalServiceClient(authHeader);
    const orderMessageKey = await getOrderMessageKey(external);

    // Handle refund actions via POST with action param
    if (req.method === "POST" && action) {
      const body = await req.json();
      const senderUsername = await getUsername(userId, authHeader);
      const formattedUsername = formatUsername(senderUsername);

      if (action === "refund_request" && isBuyer) {
        const { reason, details, image_urls } = body;
        if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
          return new Response(JSON.stringify({ error: "Reason is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Build system message content as JSON
        const systemContent = JSON.stringify({
          type: "refund_request",
          buyer_username: senderUsername,
          reason: reason.trim().slice(0, 500),
          details: (details || "").trim().slice(0, 2000),
          image_urls: (image_urls || []).slice(0, 5),
          payment_method: orderInfo.paymentMethod,
          requested_at: new Date().toISOString(),
        });

        await insertSystemMessage(external, orderMessageKey, orderId, userId, "refund_request", systemContent);

        // Notify seller
        try {
          await insertNotificationWithFallback(external, {
            user_id: orderInfo.sellerId,
            type: "refund_request",
            title: "Refund Requested",
            message: `${formattedUsername} has requested a refund. Tap to review.`,
            related_listing_id: orderInfo.listingId,
            related_user_id: userId,
            related_order_id: orderId,
          });
        } catch (e) {
          console.error("[order-messages] Refund notification error:", e);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "refund_reject" && isSeller) {
        const systemContent = JSON.stringify({
          type: "refund_rejected",
          seller_username: senderUsername,
          payment_method: orderInfo.paymentMethod,
          rejected_at: new Date().toISOString(),
        });

        await insertSystemMessage(external, orderMessageKey, orderId, userId, "refund_rejected", systemContent);

        // Notify buyer
        try {
          await insertNotificationWithFallback(external, {
            user_id: orderInfo.buyerId,
            type: "refund_rejected",
            title: "Refund Rejected",
            message: `${formattedUsername} has rejected your refund request.`,
            related_listing_id: orderInfo.listingId,
            related_user_id: userId,
            related_order_id: orderId,
          });
        } catch (e) {
          console.error("[order-messages] Refund reject notification error:", e);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "refund_initiate" && isSeller) {
        const systemContent = JSON.stringify({
          type: "refund_initiated",
          seller_username: senderUsername,
          payment_method: orderInfo.paymentMethod,
          initiated_at: new Date().toISOString(),
        });

        await insertSystemMessage(external, orderMessageKey, orderId, userId, "refund_initiated", systemContent);

        // Notify buyer
        try {
          await insertNotificationWithFallback(external, {
            user_id: orderInfo.buyerId,
            type: "refund_initiated",
            title: "Refund Initiated",
            message: `${formattedUsername} has initiated a refund via ${orderInfo.paymentMethod === "paypal" ? "PayPal" : "Stripe"}.`,
            related_listing_id: orderInfo.listingId,
            related_user_id: userId,
            related_order_id: orderId,
          });
        } catch (e) {
          console.error("[order-messages] Refund initiate notification error:", e);
        }

        return new Response(JSON.stringify({ success: true, payment_method: orderInfo.paymentMethod }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Unrecognized action or unauthorized for this action
      return new Response(JSON.stringify({ error: "Invalid action or not authorized" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const messageFilter = orderInfo.requestedIdType === "group" && orderInfo.matchedOrderGroupId
        ? external.from("order_messages").select("*").eq(orderMessageKey, orderInfo.matchedOrderGroupId)
        : orderInfo.relatedOrderIds.length > 1
          ? external.from("order_messages").select("*").in("order_id", orderInfo.relatedOrderIds)
          : external.from("order_messages").select("*").eq(orderMessageKey, orderInfo.matchedOrderId ?? orderId);

      const { data, error } = await messageFilter.order("created_at", { ascending: true });

      if (error) throw error;

      return new Response(JSON.stringify({ messages: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      const readFilter = orderInfo.requestedIdType === "group" && orderInfo.matchedOrderGroupId
        ? external.from("order_messages").update({ read: true }).eq(orderMessageKey, orderInfo.matchedOrderGroupId)
        : orderInfo.relatedOrderIds.length > 1
          ? external.from("order_messages").update({ read: true }).in("order_id", orderInfo.relatedOrderIds)
          : external.from("order_messages").update({ read: true }).eq(orderMessageKey, orderInfo.matchedOrderId ?? orderId);

      const { error } = await readFilter
        .neq("sender_id", userId)
        .eq("read", false);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      if (deliveredAt) {
        const daysSinceDelivery =
          (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceDelivery > 10) {
          return new Response(
            JSON.stringify({ error: "Chat is read-only (10+ days since delivery)" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      const body = await req.json();
      const { message, attachment_url } = body;

      const messageInsert = orderMessageKey === "order_id"
        ? {
            order_id: orderId,
            sender_id: userId,
            message: message || "",
            attachment_url: attachment_url || null,
            message_type: "user",
          }
        : {
            order_group_id: orderId,
            sender_id: userId,
            message: message || "",
            attachment_url: attachment_url || null,
            message_type: "user",
          };

      const { data, error } = await external
        .from("order_messages")
        .insert(messageInsert)
        .select()
        .single();

      if (error) throw error;

      try {
        const senderUsername = await getUsername(userId, authHeader);
        const { data: orderData } = await external
          .from("orders")
          .select("listing_id, buyer_id, seller_id")
          .eq("id", orderId)
          .maybeSingle();

        if (orderData) {
          const recipientId = isBuyer ? orderData.seller_id : orderData.buyer_id;
          const notifType = isBuyer ? "order_message_buyer" : "order_message_seller";
          const notifMessage = isBuyer
            ? `📩 New message from your buyer ${senderUsername.startsWith("@") ? senderUsername : `@${senderUsername}`}! Tap to view.`
            : `💬 New message from ${senderUsername.startsWith("@") ? senderUsername : `@${senderUsername}`} about your order! Tap to view.`;

          await insertNotificationWithFallback(external, {
            user_id: recipientId,
            type: notifType,
            title: "New Message",
            message: notifMessage,
            related_listing_id: orderData.listing_id,
            related_user_id: userId,
            related_order_id: orderId,
          });
        }
      } catch (notifErr) {
        console.error("[order-messages] Notification error:", notifErr);
      }

      return new Response(JSON.stringify({ message: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[order-messages] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
