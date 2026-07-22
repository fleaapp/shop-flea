import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type PushPlatform = "web" | "ios";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const verifier = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userResult, error: userError } = await verifier.auth.getUser(token);
    const userId = userResult?.user?.id;
    if (userError || !userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
    const platform: PushPlatform = body.platform === "ios" ? "ios" : "web";
    const p256dh = typeof body.p256dh === "string" ? body.p256dh : null;
    const auth = typeof body.auth === "string" ? body.auth : null;

    if (!endpoint || endpoint.length < 8) {
      return json({ error: "Missing endpoint" }, 400);
    }

    if (platform === "web" && (!p256dh || !auth)) {
      return json({ error: "Missing web push keys" }, 400);
    }

    const svc = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (platform === "ios") {
      const { error: deleteError } = await svc
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("platform", "ios")
        .neq("endpoint", endpoint);

      if (deleteError) {
        console.error("[register-push-subscription] iOS stale cleanup failed:", deleteError);
      }
    }

    const { error: upsertError } = await svc.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    );

    if (upsertError) {
      console.error("[register-push-subscription] save failed:", upsertError);
      return json({ error: "Failed to save push subscription" }, 500);
    }

    console.log(`[register-push-subscription] saved ${platform} token for user ${userId}`);
    return json({ ok: true, platform });
  } catch (err) {
    console.error("[register-push-subscription] error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});