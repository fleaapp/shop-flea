// register-device
// Records the current device id on the user's profile. Called on sign-in so
// we can lock the device if the user ends up with a negative balance later.

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
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const verifier = createClient(externalUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: u, error: uErr } = await verifier.auth.getUser(token);
    if (uErr || !u?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const deviceId: string | undefined = body.deviceId;
    if (!deviceId || typeof deviceId !== "string" || deviceId.length < 4) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(externalUrl, serviceKey);
    const { data: prof } = await svc
      .from("profiles")
      .select("device_ids, negative_balance_cents")
      .eq("user_id", userId)
      .maybeSingle();

    const existing: string[] = Array.isArray(prof?.device_ids) ? prof!.device_ids : [];
    if (!existing.includes(deviceId)) {
      await svc
        .from("profiles")
        .update({ device_ids: [...existing, deviceId] })
        .eq("user_id", userId);
    }

    // If this user currently owes money, lock this device too.
    if ((prof?.negative_balance_cents ?? 0) > 0) {
      await svc.from("blocked_devices").upsert(
        {
          device_id: deviceId,
          reason: "negative_balance",
          associated_user_id: userId,
          amount_cents: prof!.negative_balance_cents,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id" },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[register-device] error:", err);
    return new Response(JSON.stringify({ error: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
