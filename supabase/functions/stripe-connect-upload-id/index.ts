import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getStripeSecretKey() {
  const key = (Deno.env.get("STRIPE_SECRET_KEY") ?? "")
    .replace(/[\s\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u3000\uFEFF]+/g, "")
    .trim();
  if (!key) throw new Error("Stripe secret key is missing.");
  return key;
}

const MAX_BYTES = 8 * 1024 * 1024;

/** Strips any data-URL prefix and whitespace from a base64 payload. */
function cleanBase64(b64: string): string {
  return String(b64 || "").replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
}

/**
 * Decoded byte length of a base64 string, computed WITHOUT decoding. Lets us
 * reject an oversized upload before it is materialised in memory.
 */
function base64ByteLength(clean: string): number {
  if (!clean) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

function base64ToBytes(clean: string): Uint8Array {
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Detects the real image format from the file's leading bytes. */
function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/heic" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  // ISO-BMFF container: bytes 4-7 are "ftyp", brand at 8-11 starts with heic/heif/mif1.
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    if (brand.startsWith("hei") || brand.startsWith("mif") || brand.startsWith("msf")) return "image/heic";
  }
  return null;
}

type DecodedImage = { bytes: Uint8Array; mime: string; ext: string };

/**
 * Validates size before decoding, then verifies the payload really is an
 * image. Returns a plain-English error message instead of throwing.
 */
function decodeImage(b64: string, label: string): DecodedImage | { error: string } {
  const clean = cleanBase64(b64);
  if (!clean) return { error: `${label} image is missing.` };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
    return { error: `${label} image could not be read. Please retake the photo.` };
  }
  if (base64ByteLength(clean) > MAX_BYTES) {
    return { error: `${label} image is too large. Please use a photo under 8MB.` };
  }
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(clean);
  } catch {
    return { error: `${label} image could not be read. Please retake the photo.` };
  }
  if (bytes.byteLength > MAX_BYTES) {
    return { error: `${label} image is too large. Please use a photo under 8MB.` };
  }
  const mime = detectImageType(bytes);
  if (!mime) {
    return { error: `${label} file must be a photo (JPEG, PNG or HEIC).` };
  }
  const ext = mime === "image/png" ? "png" : mime === "image/heic" ? "heic" : "jpg";
  return { bytes, mime, ext };
}


async function uploadIdentityFile(
  secretKey: string,
  stripeAccount: string,
  image: DecodedImage,
  basename: string,
): Promise<string> {
  const form = new FormData();
  form.append("purpose", "identity_document");
  form.append(
    "file",
    new Blob([image.bytes], { type: image.mime }),
    `${basename}.${image.ext}`,
  );


  const res = await fetch("https://files.stripe.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Stripe-Account": stripeAccount,
    },
    body: form,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Stripe file upload failed (${res.status})`);
  }
  return json.id as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Rate limit: max 5 ID upload attempts per user per hour.
    // Prevents brute-force document submission (fake ID iteration) and abuse
    // of Stripe's Files API quota. Uses the shared public.rate_limits table.
    try {
      const rlClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data: allowed, error: rlErr } = await rlClient.rpc('check_and_record_rate_limit', {
        _key: `stripe-upload-id:${user.id}`,
        _max: 5,
        _window_seconds: 3600,
      });
      if (!rlErr && allowed === false) {
        return new Response(
          JSON.stringify({ error: 'Too many ID upload attempts. Please try again in an hour.' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 },
        );
      }
    } catch (e) {
      console.warn('[stripe-connect-upload-id] rate limit check failed:', e);
    }

    const body = await req.json();
    const { accountId, frontBase64, backBase64 } = body as {
      accountId?: string;
      frontBase64?: string;
      backBase64?: string;
    };

    if (!accountId || !frontBase64) {
      return new Response(JSON.stringify({ error: "Missing accountId or front image." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Demo/review account — no-op success.
    if (typeof accountId === "string" && accountId.startsWith("acct_demo_")) {
      return new Response(JSON.stringify({ ok: true, demo: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const secretKey = getStripeSecretKey();
    const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" });

    // Verify ownership
    const acct = await stripe.accounts.retrieve(accountId);
    if ((acct as any).metadata?.flea_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Account not owned by user." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Validate size before decoding, and confirm the payload is a real image.
    const badRequest = (error: string) =>
      new Response(JSON.stringify({ error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });

    const front = decodeImage(frontBase64, "Front");
    if ("error" in front) return badRequest(front.error);

    let back: DecodedImage | null = null;
    if (backBase64) {
      const decodedBack = decodeImage(backBase64, "Back");
      if ("error" in decodedBack) return badRequest(decodedBack.error);
      back = decodedBack;
    }

    const frontFileId = await uploadIdentityFile(secretKey, accountId, front, "id-front");
    const backFileId = back
      ? await uploadIdentityFile(secretKey, accountId, back, "id-back")
      : undefined;


    await stripe.accounts.update(accountId, {
      individual: {
        verification: {
          document: {
            front: frontFileId,
            ...(backFileId ? { back: backFileId } : {}),
          },
        },
      },
    } as any);

    const refreshed = await stripe.accounts.retrieve(accountId);
    const currentlyDue = refreshed.requirements?.currently_due ?? [];
    const pastDue = refreshed.requirements?.past_due ?? [];
    const pendingVerification = refreshed.requirements?.pending_verification ?? [];

    return new Response(
      JSON.stringify({
        ok: true,
        payoutsEnabled: !!refreshed.payouts_enabled,
        chargesEnabled: !!refreshed.charges_enabled,
        currentlyDue,
        pastDue,
        pendingVerification,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[stripe-connect-upload-id] error:", error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to upload ID." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
