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

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:image\/\w+;base64,/, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function uploadIdentityFile(
  secretKey: string,
  stripeAccount: string,
  bytes: Uint8Array,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append("purpose", "identity_document");
  form.append(
    "file",
    new Blob([bytes], { type: "image/jpeg" }),
    filename,
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
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
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

    // Basic size guard — Stripe caps identity docs at 8MB, we accept up to ~6MB base64.
    const frontBytes = base64ToBytes(frontBase64);
    if (frontBytes.byteLength > 8 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Front image too large (max 8MB)." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    let backBytes: Uint8Array | null = null;
    if (backBase64) {
      backBytes = base64ToBytes(backBase64);
      if (backBytes.byteLength > 8 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Back image too large (max 8MB)." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    const frontFileId = await uploadIdentityFile(secretKey, accountId, frontBytes, "id-front.jpg");
    const backFileId = backBytes
      ? await uploadIdentityFile(secretKey, accountId, backBytes, "id-back.jpg")
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
