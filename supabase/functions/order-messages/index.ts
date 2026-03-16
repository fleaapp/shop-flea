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

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
  const externalAnonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
  const client = createClient(externalUrl, externalAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await client.auth.getUser();

  return user?.id ?? null;
}

function getExternalServiceClient() {
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, serviceKey);
}

let orderMessageKeyCache: "order_id" | "order_group_id" | null = null;

async function getOrderMessageKey(
  extClient: ReturnType<typeof getExternalServiceClient>,
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
  orderId: string,
): Promise<{ isBuyer: boolean; isSeller: boolean; deliveredAt: string | null }> {
  const extClient = getExternalServiceClient();

  const { data: order } = await extClient
    .from("orders")
    .select("buyer_id, seller_id, delivered_at")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { isBuyer: false, isSeller: false, deliveredAt: null };

  return {
    isBuyer: order.buyer_id === userId,
    isSeller: order.seller_id === userId,
    deliveredAt: order.delivered_at,
  };
}

async function getUsername(userId: string): Promise<string> {
  const extClient = getExternalServiceClient();

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
  extClient: ReturnType<typeof getExternalServiceClient>,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { isBuyer, isSeller, deliveredAt } = await isOrderParticipant(userId, orderId);
    if (!isBuyer && !isSeller) {
      return new Response(JSON.stringify({ error: "Not a participant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const external = getExternalServiceClient();

    if (req.method === "GET") {
      const { data, error } = await external
        .from("order_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return new Response(JSON.stringify({ messages: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      const { error } = await external
        .from("order_messages")
        .update({ read: true })
        .eq("order_id", orderId)
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

      const { data, error } = await external
        .from("order_messages")
        .insert({
          order_id: orderId,
          sender_id: userId,
          message: message || "",
          attachment_url: attachment_url || null,
        })
        .select()
        .single();

      if (error) throw error;

      try {
        const senderUsername = await getUsername(userId);
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
