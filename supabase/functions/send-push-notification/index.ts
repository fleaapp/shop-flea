import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VAPID_PUBLIC_KEY = "BOaAjWRbh4KQDJcS-Cx8XHtz7MFnI9RAfnXSW2U2J48f7gQiud-cFkT2jjSluV2tR_MQIDHYUPh-5AJucHLbmhA";

const ALERT_TITLES: Record<string, string> = {
  item_sold: "🎉 Item Sold!",
  order_shipped: "📦 Order Shipped",
  order_delivered: "🏠 Order Delivered",
  new_review: "⭐ New Review",
  new_comment: "💬 New Comment",
  comment_reply: "↩️ Reply",
  mention: "📣 Mentioned",
  shipping_reminder_3d: "🚨 Shipping Reminder",
  shipping_reminder_6d: "🚨 Urgent: Ship Now",
  order_message_seller: "💬 New Message",
  order_message_buyer: "📩 New Message",
  support_message: "🛎️ Support",
  refund_request: "🔄 Refund Requested",
  refund_rejected: "❌ Refund Rejected",
  refund_initiated: "✅ Refund Initiated",
  cart_item_sold: "🛒 Cart Item Sold",
  wishlist_item_sold: "😢 Wishlist Item Sold",
  cart_wishlist_item_sold: "💔 Item Sold",
  payment_action_required: "⚠️ Payment Action Required",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: require either the service role key (used by server-side
    // edge functions / triggers) OR a valid user JWT. This blocks anonymous
    // callers from sending arbitrary push notifications to any user.
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const serviceRoleKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const anonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";

    // Accept either the Lovable Cloud service role (used by webhooks/triggers
    // on this project) or the external Supabase service role.
    const cloudServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    let authorized = false;
    let isServiceRole = false;
    let callerUserId: string | null = null;
    if (bearer && ((serviceRoleKey && bearer === serviceRoleKey) || (cloudServiceRoleKey && bearer === cloudServiceRoleKey))) {
      authorized = true;
      isServiceRole = true;
    } else if (bearer) {
      try {
        const verifier = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await verifier.auth.getUser(bearer);
        if (!error && data?.user?.id) {
          authorized = true;
          callerUserId = data.user.id;
        }
      } catch (_) {
        authorized = false;
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, notification } = await req.json();

    // SECURITY: non-service-role callers may only push to themselves.
    if (!isServiceRole && user_id !== callerUserId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user_id || !notification) {
      return new Response(JSON.stringify({ error: "Missing user_id or notification" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID_PRIVATE_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configure web-push with VAPID keys
    webpush.setVapidDetails(
      "mailto:hello@finditonflea.com",
      VAPID_PUBLIC_KEY,
      vapidPrivateKey
    );

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    console.log("[Push] Using Supabase URL:", supabaseUrl?.slice(0, 30));

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError) {
      console.error("[Push] Error fetching subscriptions:", subError);
      return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[Push] No subscriptions found for user:", user_id);
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Push] Found ${subscriptions.length} subscription(s) for user ${user_id}`);

    const title = ALERT_TITLES[notification.type] || notification.title || "Flea";
    const body = notification.message?.slice(0, 200) || "";
    const pushPayload = JSON.stringify({
      title,
      body,
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      data: {
        type: notification.type,
        related_listing_id: notification.related_listing_id,
        related_order_id: notification.related_order_id,
        related_thread_id: notification.related_thread_id,
      },
    });

    let sent = 0;
    const staleEndpoints: string[] = [];

    // --- APNs JWT cache (ES256, valid 1h, refresh every ~50min) ---
    const apnsKeyId = Deno.env.get("APNS_KEY_ID") ?? "";
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID") ?? "";
    const apnsBundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "";
    const apnsAuthKeyPem = Deno.env.get("APNS_AUTH_KEY") ?? "";
    const apnsHost = (Deno.env.get("APNS_HOST") ?? "api.push.apple.com").trim();

    let apnsJwt: string | null = null;
    const buildApnsJwt = async (): Promise<string> => {
      if (apnsJwt) return apnsJwt;
      if (!apnsKeyId || !apnsTeamId || !apnsAuthKeyPem) {
        throw new Error("APNs not configured");
      }
      const pemBody = apnsAuthKeyPem
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\s+/g, "");
      const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
      const key = await crypto.subtle.importKey(
        "pkcs8",
        der,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
      );
      const enc = (obj: unknown) =>
        btoa(JSON.stringify(obj))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const header = enc({ alg: "ES256", kid: apnsKeyId });
      const payload = enc({ iss: apnsTeamId, iat: Math.floor(Date.now() / 1000) });
      const signingInput = `${header}.${payload}`;
      const sig = new Uint8Array(
        await crypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          key,
          new TextEncoder().encode(signingInput),
        ),
      );
      const sigB64 = btoa(String.fromCharCode(...sig))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      apnsJwt = `${signingInput}.${sigB64}`;
      return apnsJwt;
    };

    const sendApns = async (deviceToken: string) => {
      const jwt = await buildApnsJwt();
      const apsPayload = JSON.stringify({
        aps: {
          alert: { title, body },
          sound: "default",
          badge: 1,
        },
        type: notification.type,
        related_listing_id: notification.related_listing_id,
        related_order_id: notification.related_order_id,
        related_thread_id: notification.related_thread_id,
      });
      const res = await fetch(`https://${apnsHost}/3/device/${deviceToken}`, {
        method: "POST",
        headers: {
          "authorization": `bearer ${jwt}`,
          "apns-topic": apnsBundleId,
          "apns-push-type": "alert",
          "content-type": "application/json",
        },
        body: apsPayload,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const err: any = new Error(`APNs ${res.status}: ${text}`);
        err.statusCode = res.status;
        err.body = text;
        throw err;
      }
    };

    for (const sub of subscriptions) {
      try {
        if (sub.platform === "ios") {
          console.log(`[Push] APNs → ${sub.endpoint.slice(0, 16)}…`);
          await sendApns(sub.endpoint);
          sent++;
          continue;
        }

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        console.log(`[Push] Web → ${sub.endpoint.slice(0, 60)}…`);
        const result = await webpush.sendNotification(pushSubscription, pushPayload);
        sent++;
        console.log(`[Push] Web success status=${result.statusCode}`);
      } catch (e: any) {
        console.error(`[Push] Failed (${sub.platform || "web"}):`, e?.statusCode, e?.body || e?.message);
        // APNs 410 = unregistered, 400 BadDeviceToken; web-push 404/410 = gone
        if (e?.statusCode === 404 || e?.statusCode === 410 || /BadDeviceToken/i.test(e?.body || "")) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    }

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      console.log(`[Push] Cleaning up ${staleEndpoints.length} stale subscription(s)`);
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user_id)
        .in("endpoint", staleEndpoints);
    }


    console.log(`[Push] Result: sent=${sent}, total=${subscriptions.length}`);
    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[Push] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
