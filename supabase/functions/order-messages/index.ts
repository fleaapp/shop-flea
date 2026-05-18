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
    const verifier = createClient(EXTERNAL_PUBLIC_URL, EXTERNAL_PUBLIC_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

type ExternalClient = ReturnType<typeof getExternalClient>;

type RefundImageUpload = {
  fileName: string;
  contentType: string;
  base64: string;
};

type OrderMessageInsertInput = {
  senderId: string;
  message: string;
  attachmentUrl?: string | null;
  messageType?: string;
};

type OrderMessageRow = {
  id?: string;
  sender_id: string;
  message: string;
  attachment_url?: string | null;
  message_type?: string | null;
  created_at?: string;
  read?: boolean;
  order_id?: string;
  order_group_id?: string;
};

let orderMessageKeyCache: "order_id" | "order_group_id" | null = null;
let orderMessagesSupportsMessageTypeCache: boolean | null = null;

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: string; message?: string; details?: string | null };
  const errorText = `${candidate.message ?? ""} ${candidate.details ?? ""}`;

  return (candidate.code === "PGRST204" || candidate.code === "42703") && errorText.includes(columnName);
}

function deriveMessageType(message: string): string {
  try {
    const parsed = JSON.parse(message) as { type?: string };
    if (
      parsed?.type === "refund_request" ||
      parsed?.type === "refund_rejected" ||
      parsed?.type === "refund_initiated"
    ) {
      return parsed.type;
    }
  } catch {
    // Ignore non-JSON user messages.
  }

  return "user";
}

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

type OrderLookupRow = {
  id: string;
  order_group_id: string | null;
  buyer_id: string;
  seller_id: string;
  delivered_at: string | null;
  listing_id: string;
  created_at?: string;
  payment_method?: string | null;
};

async function fetchOrderByIdWithFallback(
  serviceClient: ExternalClient,
  requestedOrderId: string,
): Promise<{ data: OrderLookupRow | null; error: unknown }> {
  const preferredFields = "id, order_group_id, buyer_id, seller_id, delivered_at, listing_id, created_at, payment_method";
  const fallbackFields = "id, order_group_id, buyer_id, seller_id, delivered_at, listing_id, created_at";

  const preferredResponse = await serviceClient
    .from("orders")
    .select(preferredFields)
    .eq("id", requestedOrderId)
    .maybeSingle();

  if (!preferredResponse.error || !isMissingColumnError(preferredResponse.error, "payment_method")) {
    return {
      data: (preferredResponse.data as OrderLookupRow | null) ?? null,
      error: preferredResponse.error,
    };
  }

  console.warn("[order-messages] orders.payment_method missing on id lookup, retrying without it");

  const fallbackResponse = await serviceClient
    .from("orders")
    .select(fallbackFields)
    .eq("id", requestedOrderId)
    .maybeSingle();

  return {
    data: fallbackResponse.data
      ? ({ ...fallbackResponse.data, payment_method: "stripe" } as OrderLookupRow)
      : null,
    error: fallbackResponse.error,
  };
}

async function fetchOrderByGroupWithFallback(
  serviceClient: ExternalClient,
  requestedOrderId: string,
): Promise<{ data: OrderLookupRow[] | null; error: unknown }> {
  const preferredFields = "id, order_group_id, buyer_id, seller_id, delivered_at, listing_id, created_at, payment_method";
  const fallbackFields = "id, order_group_id, buyer_id, seller_id, delivered_at, listing_id, created_at";

  const preferredResponse = await serviceClient
    .from("orders")
    .select(preferredFields)
    .eq("order_group_id", requestedOrderId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (!preferredResponse.error || !isMissingColumnError(preferredResponse.error, "payment_method")) {
    return {
      data: (preferredResponse.data as OrderLookupRow[] | null) ?? null,
      error: preferredResponse.error,
    };
  }

  console.warn("[order-messages] orders.payment_method missing on group lookup, retrying without it");

  const fallbackResponse = await serviceClient
    .from("orders")
    .select(fallbackFields)
    .eq("order_group_id", requestedOrderId)
    .order("created_at", { ascending: true })
    .limit(1);

  return {
    data: fallbackResponse.data
      ? fallbackResponse.data.map((row) => ({ ...row, payment_method: "stripe" } as OrderLookupRow))
      : null,
    error: fallbackResponse.error,
  };
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
  const serviceClient = getExternalServiceClient(authHeader);
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

  const byIdResponse = await fetchOrderByIdWithFallback(serviceClient, requestedOrderId);

  if (byIdResponse.error && (byIdResponse.error as { code?: string }).code !== "PGRST116") {
    console.error("[order-messages] Failed order lookup by id:", byIdResponse.error);
  }

  const byGroupResponse = byIdResponse.data
    ? { data: null, error: null }
    : await fetchOrderByGroupWithFallback(serviceClient, requestedOrderId);

  if (byGroupResponse.error) {
    console.error("[order-messages] Failed order lookup by group id:", byGroupResponse.error);
  }

  const order = byIdResponse.data ?? byGroupResponse.data?.[0] ?? null;
  const requestedIdType = byIdResponse.data
    ? "order" as const
    : order
      ? "group" as const
      : "unknown" as const;

  if (!order) {
    console.error("[order-messages] No matching order found for:", requestedOrderId);
    return emptyState;
  }

  if (order.buyer_id !== userId && order.seller_id !== userId) {
    console.error("[order-messages] User is not participant:", {
      requestedOrderId,
      userId,
      buyerId: order.buyer_id,
      sellerId: order.seller_id,
    });
    return emptyState;
  }

  let relatedOrderIds = [order.id];
  if (order.order_group_id) {
    const groupedOrdersResponse = await serviceClient
      .from("orders")
      .select("id")
      .eq("order_group_id", order.order_group_id)
      .order("created_at", { ascending: true });

    if (groupedOrdersResponse.error) {
      console.error("[order-messages] Failed grouped order lookup:", groupedOrdersResponse.error);
    } else if (groupedOrdersResponse.data?.length) {
      relatedOrderIds = groupedOrdersResponse.data.map((groupedOrder) => groupedOrder.id);
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

async function firePushNotification(payload: NotificationInsert) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? `https://teaicrimlqdayqpmxasc.supabase.co`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        user_id: payload.user_id,
        notification: {
          type: payload.type,
          title: payload.title,
          message: payload.message,
          related_listing_id: payload.related_listing_id,
          related_order_id: payload.related_order_id,
          related_thread_id: payload.related_thread_id,
        },
      }),
    });
    const text = await res.text();
    console.log("[order-messages] Push result:", res.status, text);
  } catch (e) {
    console.error("[order-messages] Push fire error:", e);
  }
}

async function insertNotificationWithFallback(
  extClient: ExternalClient,
  payload: NotificationInsert,
) {
  const { error } = await extClient.from("notifications").insert(payload);
  if (!error) {
    // Fire push notification directly since external DB triggers can't call our edge functions
    await firePushNotification(payload);
    return;
  }

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

  // Fire push even on fallback path
  await firePushNotification(payload);
}

async function insertOrderMessage(
  extClient: ExternalClient,
  orderMessageKey: "order_id" | "order_group_id",
  orderId: string,
  input: OrderMessageInsertInput,
): Promise<OrderMessageRow> {
  const baseInsert = {
    sender_id: input.senderId,
    message: input.message || "",
    attachment_url: input.attachmentUrl || null,
  };

  const recordWithoutType = orderMessageKey === "order_id"
    ? { ...baseInsert, order_id: orderId }
    : { ...baseInsert, order_group_id: orderId };

  const shouldIncludeMessageType = input.messageType && orderMessagesSupportsMessageTypeCache !== false;
  const recordWithOptionalType = shouldIncludeMessageType
    ? { ...recordWithoutType, message_type: input.messageType }
    : recordWithoutType;

  const { data, error } = await extClient
    .from("order_messages")
    .insert(recordWithOptionalType)
    .select()
    .single();

  if (!error) {
    if (shouldIncludeMessageType) {
      orderMessagesSupportsMessageTypeCache = true;
    }

    return {
      ...(data as OrderMessageRow),
      message_type: (data as OrderMessageRow)?.message_type ?? input.messageType ?? deriveMessageType(input.message),
    };
  }

  if (shouldIncludeMessageType && isMissingColumnError(error, "message_type")) {
    orderMessagesSupportsMessageTypeCache = false;

    const fallbackResponse = await extClient
      .from("order_messages")
      .insert(recordWithoutType)
      .select()
      .single();

    if (fallbackResponse.error) throw fallbackResponse.error;

    return {
      ...(fallbackResponse.data as OrderMessageRow),
      message_type: input.messageType ?? deriveMessageType(input.message),
    };
  }

  throw error;
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
  return insertOrderMessage(extClient, orderMessageKey, orderId, {
    senderId,
    message,
    attachmentUrl,
    messageType,
  });
}

function formatUsername(username: string): string {
  return username.startsWith("@") ? username : `@${username}`;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function uploadRefundImages(
  extClient: ExternalClient,
  userId: string,
  orderId: string,
  imageUploads: RefundImageUpload[],
): Promise<string[]> {
  const imageUrls: string[] = [];

  for (const [index, image] of imageUploads.entries()) {
    const safeFileName = image.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${userId}/${orderId}/refund-${Date.now()}-${index}-${safeFileName}`;
    const contentType = image.contentType || "image/jpeg";

    const { error: uploadError } = await extClient.storage
      .from("order-attachments")
      .upload(path, decodeBase64(image.base64), {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || "Image upload failed");
    }

    const { data } = extClient.storage.from("order-attachments").getPublicUrl(path);
    imageUrls.push(data.publicUrl);
  }

  return imageUrls;
}

function getThreadOrderId(
  orderInfo: Awaited<ReturnType<typeof isOrderParticipant>>,
  orderMessageKey: "order_id" | "order_group_id",
  requestedOrderId: string,
): string {
  if (orderMessageKey === "order_group_id") {
    return orderInfo.matchedOrderGroupId ?? orderInfo.matchedOrderId ?? requestedOrderId;
  }

  return orderInfo.matchedOrderId ?? requestedOrderId;
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
    const threadOrderId = getThreadOrderId(orderInfo, orderMessageKey, orderId);

    if (req.method === "POST" && action) {
      const body = await req.json();
      const senderUsername = await getUsername(userId, authHeader);
      const formattedUsername = formatUsername(senderUsername);

      if (action === "refund_request" && isBuyer) {
        const { reason, details, image_urls, image_uploads } = body;
        if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
          return new Response(JSON.stringify({ error: "Reason is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const uploadedImageUrls = Array.isArray(image_uploads)
          ? await uploadRefundImages(external, userId, threadOrderId, image_uploads as RefundImageUpload[])
          : [];
        const systemContent = JSON.stringify({
          type: "refund_request",
          buyer_username: senderUsername,
          reason: reason.trim().slice(0, 500),
          details: (details || "").trim().slice(0, 2000),
          image_urls: uploadedImageUrls.length ? uploadedImageUrls : (image_urls || []).slice(0, 5),
          payment_method: orderInfo.paymentMethod,
          requested_at: new Date().toISOString(),
        });

        await insertSystemMessage(external, orderMessageKey, threadOrderId, userId, "refund_request", systemContent);

        try {
          await insertNotificationWithFallback(external, {
            user_id: orderInfo.sellerId,
            type: "refund_request",
            title: "Refund Requested",
            message: `${formattedUsername} has requested a refund. Tap to review.`,
            related_listing_id: orderInfo.listingId,
            related_user_id: userId,
            related_order_id: orderInfo.matchedOrderGroupId ?? orderInfo.matchedOrderId ?? threadOrderId,
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

        await insertSystemMessage(external, orderMessageKey, threadOrderId, userId, "refund_rejected", systemContent);

        try {
          await insertNotificationWithFallback(external, {
            user_id: orderInfo.buyerId,
            type: "refund_rejected",
            title: "Refund Rejected",
            message: `${formattedUsername} has rejected your refund request.`,
            related_listing_id: orderInfo.listingId,
            related_user_id: userId,
            related_order_id: orderInfo.matchedOrderGroupId ?? orderInfo.matchedOrderId ?? threadOrderId,
          });
        } catch (e) {
          console.error("[order-messages] Refund reject notification error:", e);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "refund_initiate" && isSeller) {
        // For Stripe orders the refund is executed atomically by
        // stripe-connect-refund before this is called, so the
        // refund_initiated system message + buyer notification are safe to
        // emit now. PayPal still falls through to the same flow (the seller
        // completes the refund in PayPal's dashboard).
        const systemContent = JSON.stringify({
          type: "refund_initiated",
          seller_username: senderUsername,
          payment_method: orderInfo.paymentMethod,
          initiated_at: new Date().toISOString(),
        });
        try {
          await insertSystemMessage(external, orderMessageKey, threadOrderId, userId, "refund_initiated", systemContent);
          await insertNotificationWithFallback(external, {
            user_id: orderInfo.buyerId,
            type: "refund_initiated",
            title: "Refund Initiated",
            message: `${formattedUsername} has initiated your refund. It will appear in your account shortly.`,
            related_listing_id: orderInfo.listingId,
            related_user_id: userId,
            related_order_id: orderInfo.matchedOrderGroupId ?? orderInfo.matchedOrderId ?? threadOrderId,
          });
        } catch (e) {
          console.error("[order-messages] Refund initiate notify error:", e);
        }
        return new Response(JSON.stringify({ success: true, payment_method: orderInfo.paymentMethod }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      const messages = ((data as OrderMessageRow[] | null) ?? []).map((row) => ({
        ...row,
        message_type: row.message_type ?? deriveMessageType(row.message),
      }));

      return new Response(JSON.stringify({ messages }), {
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

      const data = await insertOrderMessage(external, orderMessageKey, threadOrderId, {
        senderId: userId,
        message: message || "",
        attachmentUrl: attachment_url || null,
        messageType: "user",
      });

      try {
        const senderUsername = await getUsername(userId, authHeader);
        const recipientId = isBuyer ? orderInfo.sellerId : orderInfo.buyerId;
        const notifType = isBuyer ? "order_message_buyer" : "order_message_seller";
        const notifMessage = isBuyer
          ? `📩 New message from your buyer ${senderUsername.startsWith("@") ? senderUsername : `@${senderUsername}`}! Tap to view.`
          : `💬 New message from ${senderUsername.startsWith("@") ? senderUsername : `@${senderUsername}`} about your order! Tap to view.`;

        await insertNotificationWithFallback(external, {
          user_id: recipientId,
          type: notifType,
          title: "New Message",
          message: notifMessage,
          related_listing_id: orderInfo.listingId,
          related_user_id: userId,
          related_order_id: orderInfo.matchedOrderGroupId ?? orderInfo.matchedOrderId ?? threadOrderId,
        });
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
