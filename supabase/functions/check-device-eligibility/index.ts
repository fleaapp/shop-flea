// check-device-eligibility
// Called from the sign-up path BEFORE creating an auth user. If the device
// is tied to an account with an unsettled negative balance, block re-registration.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const deviceId: string | undefined = body.deviceId;
    if (!deviceId || typeof deviceId !== "string" || deviceId.length < 4) {
      // No usable device fingerprint — allow (web fallback).
      return new Response(JSON.stringify({ eligible: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const svc = createClient(externalUrl, serviceKey);

    const { data: blocked } = await svc
      .from("blocked_devices")
      .select("device_id, reason, amount_cents, associated_user_id")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (blocked) {
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: blocked.reason,
          amountCents: blocked.amount_cents ?? 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ eligible: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[check-device-eligibility] error:", err);
    // Fail-open so a bug doesn't block all signups.
    return new Response(JSON.stringify({ eligible: true, error: err?.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
