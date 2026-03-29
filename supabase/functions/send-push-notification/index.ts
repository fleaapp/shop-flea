import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VAPID_PUBLIC_KEY = "BOaAjWRbh4KQDJcS-Cx8XHtz7MFnI9RAfnXSW2U2J48f7gQiud-cFkT2jjSluV2tR_MQIDHYUPh-5AJucHLbmhA";

// Convert base64url to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Import ECDSA key for VAPID signing
async function importVapidKey(privateKeyBase64url: string): Promise<CryptoKey> {
  const rawPrivateKey = base64urlToUint8Array(privateKeyBase64url);
  const publicKeyBytes = base64urlToUint8Array(VAPID_PUBLIC_KEY);

  // Build JWK from raw keys
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToBase64url(publicKeyBytes.slice(1, 33)),
    y: uint8ArrayToBase64url(publicKeyBytes.slice(33, 65)),
    d: uint8ArrayToBase64url(rawPrivateKey),
  };

  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Create VAPID JWT
async function createVapidJwt(audience: string, privateKey: CryptoKey): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: "mailto:hello@finditonflea.com",
  };

  const encodedHeader = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format for Web Push
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  
  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  } else {
    // DER format
    const rLen = sigBytes[3];
    const rStart = 4;
    r = sigBytes.slice(rStart, rStart + rLen);
    const sLen = sigBytes[rStart + rLen + 1];
    const sStart = rStart + rLen + 2;
    s = sigBytes.slice(sStart, sStart + sLen);
  }

  // Pad/trim to 32 bytes
  const rPadded = new Uint8Array(32);
  const sPadded = new Uint8Array(32);
  rPadded.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  sPadded.set(s.length > 32 ? s.slice(s.length - 32) : s, 32 - Math.min(s.length, 32));

  const rawSig = new Uint8Array(64);
  rawSig.set(rPadded, 0);
  rawSig.set(sPadded, 32);

  return `${unsignedToken}.${uint8ArrayToBase64url(rawSig)}`;
}

// HKDF for encryption keys
async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, salt.length ? salt : new Uint8Array(32)));
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  const result = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, infoWithCounter));
  return result.slice(0, length);
}

// Encrypt payload using Web Push encryption (aes128gcm)
async function encryptPayload(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const clientPublicKey = base64urlToUint8Array(subscription.p256dh);
  const clientAuth = base64urlToUint8Array(subscription.auth);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  // Derive shared secret
  const clientKey = await crypto.subtle.importKey("raw", clientPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, localKeyPair.privateKey, 256));

  // Salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive encryption keys
  const encoder = new TextEncoder();
  const authInfo = encoder.encode("Content-Encoding: auth\0");
  const prkCombine = await hkdf(sharedSecret, clientAuth, authInfo, 32);

  const keyInfoBuf = new Uint8Array(encoder.encode("Content-Encoding: aes128gcm\0").length + 1 + 65 + 1 + 65);
  let offset = 0;
  const keyInfoPrefix = encoder.encode("Content-Encoding: aes128gcm\0");
  keyInfoBuf.set(keyInfoPrefix, offset); offset += keyInfoPrefix.length;
  keyInfoBuf.set(clientPublicKey, offset); offset += clientPublicKey.length;
  keyInfoBuf.set(localPublicKeyRaw, offset);
  
  const contentKey = await hkdf(prkCombine, salt, keyInfoBuf.slice(0, offset + localPublicKeyRaw.length), 16);

  const nonceInfoBuf = new Uint8Array(encoder.encode("Content-Encoding: nonce\0").length + 65 + 65);
  let nOffset = 0;
  const nonceInfoPrefix = encoder.encode("Content-Encoding: nonce\0");
  nonceInfoBuf.set(nonceInfoPrefix, nOffset); nOffset += nonceInfoPrefix.length;
  nonceInfoBuf.set(clientPublicKey, nOffset); nOffset += clientPublicKey.length;
  nonceInfoBuf.set(localPublicKeyRaw, nOffset);
  
  const nonce = await hkdf(prkCombine, salt, nonceInfoBuf.slice(0, nOffset + localPublicKeyRaw.length), 12);

  // Encrypt
  const paddedPayload = new Uint8Array(new TextEncoder().encode(payload).length + 1);
  paddedPayload.set(new TextEncoder().encode(payload));
  paddedPayload[paddedPayload.length - 1] = 2; // padding delimiter

  const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const encryptedData = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload));

  // Build aes128gcm header + encrypted data
  const recordSize = paddedPayload.length + 16; // data + tag
  const header = new Uint8Array(16 + 4 + 1 + 65); // salt + rs + idlen + keyid
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = 65; // key id length
  header.set(localPublicKeyRaw, 21);

  const result = new Uint8Array(header.length + encryptedData.length);
  result.set(header);
  result.set(encryptedData, header.length);

  return { encrypted: result, salt, localPublicKey: localPublicKeyRaw };
}

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
    const { user_id, notification } = await req.json();

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

    const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    console.log("Using Supabase URL:", supabaseUrl?.slice(0, 30));

    // Get user's push subscriptions (with schema cache reload retry)
    let subscriptions: any[] | null = null;
    let subError: any = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", user_id);
      
      subscriptions = result.data;
      subError = result.error;

      if (subError?.code === "PGRST205" && attempt === 0) {
        // Reload schema cache via PostgREST NOTIFY
        try {
          await fetch(`${supabaseUrl}/rest/v1/rpc/reload_schema_cache`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": serviceRoleKey,
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
          });
        } catch (_) { /* ignore */ }
        // Wait a moment for cache to refresh
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      break;
    }

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signingKey = await importVapidKey(vapidPrivateKey);
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

    for (const sub of subscriptions) {
      try {
        const endpoint = new URL(sub.endpoint);
        const audience = `${endpoint.protocol}//${endpoint.host}`;
        const jwt = await createVapidJwt(audience, signingKey);

        const { encrypted } = await encryptPayload(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          pushPayload
        );

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            TTL: "86400",
          },
          body: encrypted,
        });

        if (response.status === 201 || response.status === 200) {
          sent++;
        } else if (response.status === 404 || response.status === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          console.error(`Push failed for ${sub.endpoint}: ${response.status} ${await response.text()}`);
        }
      } catch (e) {
        console.error(`Push error for subscription:`, e);
      }
    }

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user_id)
        .in("endpoint", staleEndpoints);
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Push notification error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
