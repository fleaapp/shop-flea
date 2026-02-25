import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Validate JWT against the external Supabase to get user id
async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
  const externalAnonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
  const client = createClient(externalUrl, externalAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await client.auth.getUser();
  return user?.id ?? null;
}

// Cloud Supabase service client (where order_messages table lives)
function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, serviceKey);
}

// Check that user is buyer or seller on this order group
async function isOrderParticipant(
  userId: string,
  orderGroupId: string
): Promise<{ isBuyer: boolean; isSeller: boolean; deliveredAt: string | null }> {
  const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
  const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const extClient = createClient(externalUrl, externalServiceKey);

  // Check by order_group_id first, then by order id
  let { data: orders } = await extClient
    .from("orders")
    .select("buyer_id, seller_id, delivered_at")
    .eq("order_group_id", orderGroupId);

  if (!orders?.length) {
    ({ data: orders } = await extClient
      .from("orders")
      .select("buyer_id, seller_id, delivered_at")
      .eq("id", orderGroupId));
  }

  if (!orders?.length) return { isBuyer: false, isSeller: false, deliveredAt: null };

  const order = orders[0];
  return {
    isBuyer: order.buyer_id === userId,
    isSeller: order.seller_id === userId,
    deliveredAt: order.delivered_at,
  };
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
    const orderGroupId = url.searchParams.get("orderGroupId");
    if (!orderGroupId) {
      return new Response(JSON.stringify({ error: "orderGroupId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify participant
    const { isBuyer, isSeller, deliveredAt } = await isOrderParticipant(userId, orderGroupId);
    if (!isBuyer && !isSeller) {
      return new Response(JSON.stringify({ error: "Not a participant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cloud = getServiceClient();

    // GET: list messages
    if (req.method === "GET") {
      const { data, error } = await cloud
        .from("order_messages")
        .select("*")
        .eq("order_group_id", orderGroupId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return new Response(JSON.stringify({ messages: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH: mark messages as read
    if (req.method === "PATCH") {
      await cloud
        .from("order_messages")
        .update({ read: true })
        .eq("order_group_id", orderGroupId)
        .neq("sender_id", userId)
        .eq("read", false);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: send message
    if (req.method === "POST") {
      // Check 10-day expiry
      if (deliveredAt) {
        const daysSinceDelivery = (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceDelivery > 10) {
          return new Response(JSON.stringify({ error: "Chat is read-only (10+ days since delivery)" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const body = await req.json();
      const { message, attachment_url } = body;

      const { data, error } = await cloud
        .from("order_messages")
        .insert({
          order_group_id: orderGroupId,
          sender_id: userId,
          message: message || "",
          attachment_url: attachment_url || null,
        })
        .select()
        .single();

      if (error) throw error;

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
