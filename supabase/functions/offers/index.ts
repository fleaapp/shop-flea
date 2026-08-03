// Offers endpoint: create / respond / withdraw / blast.
//
// All price and permission rules live in the SECURITY DEFINER RPCs
// (create_offer, respond_to_offer, withdraw_offer). This function calls those
// RPCs as the signed-in user, then writes the in-app notification rows and
// fires push with the service role (clients cannot insert notifications).
import { rejectUntrustedOrigin } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function svc() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function verifyUser(token: string): Promise<string | null> {
  try {
    const verifier = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

const money = (n: number) => `$${Number(n).toFixed(2)}`;

type Notif = {
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_listing_id?: string | null;
  related_user_id?: string | null;
};

async function notify(admin: ReturnType<typeof svc>, rows: Notif[]) {
  if (rows.length === 0) return;
  try {
    await admin.from("notifications").insert(rows);
  } catch (e) {
    console.error("[offers] notification insert failed", e);
  }

  // Push, one call per recipient, service-role authorised.
  await Promise.all(
    rows.map(async (n) => {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ user_id: n.user_id, notification: n }),
        });
      } catch (e) {
        console.error("[offers] push failed", e);
      }
    }),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const originBlock = rejectUntrustedOrigin(req);
  if (originBlock) return originBlock;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const userId = token ? await verifyUser(token) : null;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = svc();

    const usernameOf = async (id: string) => {
      const { data } = await admin.from("profiles").select("username").eq("user_id", id).maybeSingle();
      return (data?.username ?? "@user").replace(/^@+/, "");
    };
    const listingTitle = async (id: string) => {
      const { data } = await admin.from("listings").select("title").eq("id", id).maybeSingle();
      return data?.title ?? "your item";
    };

    // ---------------------------------------------------------------- create
    if (action === "create") {
      const listingId = String(body?.listingId ?? "");
      const amount = Number(body?.amount);
      if (!listingId || !Number.isFinite(amount)) return json({ error: "Invalid request" }, 400);

      const { data, error } = await userClient.rpc("create_offer", {
        p_listing_id: listingId,
        p_amount: amount,
        p_message: typeof body?.message === "string" ? body.message : null,
        p_parent_offer_id: body?.parentOfferId ?? null,
      });
      if (error) return json({ error: error.message }, 400);

      const offer: any = Array.isArray(data) ? data[0] : data;
      const title = await listingTitle(offer.listing_id);
      const actor = await usernameOf(userId);

      if (offer.status === "accepted") {
        // Auto-accepted by the seller's rule.
        await notify(admin, [
          {
            user_id: offer.buyer_id,
            type: "offer_accepted",
            title: "Offer accepted",
            message: `🎉 Your ${money(offer.amount)} offer on "${title}" was accepted. It's in your cart at that price for 24 hours.`,
            related_listing_id: offer.listing_id,
            related_user_id: offer.seller_id,
          },
          {
            user_id: offer.seller_id,
            type: "offer_auto_accepted",
            title: "Offer auto-accepted",
            message: `💰 @${actor} offered ${money(offer.amount)} on "${title}" and it was auto-accepted.`,
            related_listing_id: offer.listing_id,
            related_user_id: offer.buyer_id,
          },
        ]);
      } else if (offer.direction === "buyer_to_seller") {
        await notify(admin, [
          {
            user_id: offer.seller_id,
            type: offer.parent_offer_id ? "offer_countered" : "offer_received",
            title: offer.parent_offer_id ? "Counter-offer received" : "New offer",
            message: `💰 @${actor} offered ${money(offer.amount)} on "${title}". You have 24 hours to reply.`,
            related_listing_id: offer.listing_id,
            related_user_id: offer.buyer_id,
          },
        ]);
      } else {
        await notify(admin, [
          {
            user_id: offer.buyer_id,
            type: offer.parent_offer_id ? "offer_countered" : "offer_discount",
            title: offer.parent_offer_id ? "Counter-offer received" : "Special offer",
            message: `💰 @${actor} offered you "${title}" for ${money(offer.amount)}. Expires in 24 hours.`,
            related_listing_id: offer.listing_id,
            related_user_id: offer.seller_id,
          },
        ]);
      }

      return json({ offer });
    }

    // --------------------------------------------------------------- respond
    if (action === "respond") {
      const offerId = String(body?.offerId ?? "");
      const decision = String(body?.decision ?? "");
      if (!offerId || !["accept", "decline"].includes(decision)) {
        return json({ error: "Invalid request" }, 400);
      }

      const { data, error } = await userClient.rpc("respond_to_offer", {
        p_offer_id: offerId,
        p_decision: decision,
      });
      if (error) return json({ error: error.message }, 400);

      const offer: any = Array.isArray(data) ? data[0] : data;
      const title = await listingTitle(offer.listing_id);
      const actor = await usernameOf(userId);
      // Notify the other side.
      const recipient = userId === offer.seller_id ? offer.buyer_id : offer.seller_id;

      if (offer.status === "accepted") {
        await notify(admin, [
          {
            user_id: recipient,
            type: "offer_accepted",
            title: "Offer accepted",
            message: recipient === offer.buyer_id
              ? `🎉 @${actor} accepted your ${money(offer.amount)} offer on "${title}". It's in your cart at that price for 24 hours.`
              : `🎉 @${actor} accepted your ${money(offer.amount)} offer on "${title}".`,
            related_listing_id: offer.listing_id,
            related_user_id: userId,
          },
        ]);
      } else {
        await notify(admin, [
          {
            user_id: recipient,
            type: "offer_declined",
            title: "Offer declined",
            message: `😔 @${actor} declined your ${money(offer.amount)} offer on "${title}".`,
            related_listing_id: offer.listing_id,
            related_user_id: userId,
          },
        ]);
      }

      return json({ offer });
    }

    // -------------------------------------------------------------- withdraw
    if (action === "withdraw") {
      const offerId = String(body?.offerId ?? "");
      if (!offerId) return json({ error: "Invalid request" }, 400);
      const { data, error } = await userClient.rpc("withdraw_offer", { p_offer_id: offerId });
      if (error) return json({ error: error.message }, 400);
      return json({ offer: Array.isArray(data) ? data[0] : data });
    }

    // ------------------------------------------------------------------ blast
    // Seller sends a discounted offer to everyone with the item saved.
    if (action === "blast") {
      const listingId = String(body?.listingId ?? "");
      const amount = Number(body?.amount);
      if (!listingId || !Number.isFinite(amount)) return json({ error: "Invalid request" }, 400);

      const { data: listing } = await admin
        .from("listings")
        .select("id, user_id, title, price, status")
        .eq("id", listingId)
        .maybeSingle();
      if (!listing || listing.user_id !== userId) return json({ error: "Not authorised" }, 403);
      if (listing.status !== "active") return json({ error: "This item is no longer available" }, 400);

      // Once per listing per 24 hours.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recent } = await admin
        .from("offers")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId)
        .eq("direction", "seller_to_buyer")
        .is("parent_offer_id", null)
        .gte("created_at", since);
      if ((recent ?? 0) > 0) {
        return json({ error: "You already sent an offer for this item in the last 24 hours." }, 429);
      }

      const [{ data: cartRows }, { data: favRows }] = await Promise.all([
        admin.from("cart_items").select("user_id").eq("listing_id", listingId),
        admin.from("favorites").select("user_id").eq("listing_id", listingId),
      ]);
      const recipients = [
        ...new Set([...(cartRows ?? []), ...(favRows ?? [])].map((r: any) => r.user_id)),
      ].filter((id) => id !== userId).slice(0, 50);

      if (recipients.length === 0) return json({ sent: 0 });

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const rows = recipients.map((buyerId) => ({
        listing_id: listingId,
        seller_id: userId,
        buyer_id: buyerId,
        amount: Math.round(amount * 100) / 100,
        original_price: listing.price,
        status: "pending",
        direction: "seller_to_buyer",
        expires_at: expiresAt,
      }));

      // Skip anyone who already has an open offer on this item.
      const { data: existing } = await admin
        .from("offers")
        .select("buyer_id")
        .eq("listing_id", listingId)
        .eq("status", "pending");
      const blocked = new Set((existing ?? []).map((r: any) => r.buyer_id));
      const toInsert = rows.filter((r) => !blocked.has(r.buyer_id));
      if (toInsert.length === 0) return json({ sent: 0 });

      const { error: insertError } = await admin.from("offers").insert(toInsert);
      if (insertError) return json({ error: insertError.message }, 400);

      const actor = await usernameOf(userId);
      await notify(
        admin,
        toInsert.map((r) => ({
          user_id: r.buyer_id,
          type: "offer_discount",
          title: "Special offer",
          message: `💰 @${actor} is offering "${listing.title}" to you for ${money(amount)}. Expires in 24 hours.`,
          related_listing_id: listingId,
          related_user_id: userId,
        })),
      );

      return json({ sent: toInsert.length });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[offers] error", err);
    await logEdgeError("offers", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
