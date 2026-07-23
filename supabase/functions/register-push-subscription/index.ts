import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type PushPlatform = "web" | "ios";

async function getVerifiedUserId(req: Request, supabaseUrl: string, anonKey: string): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;

  try {
    const verifier = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const userId = await getVerifiedUserId(req, supabaseUrl, anonKey);
    if (!userId) {
      console.warn("[register-push-subscription] unauthorized request");
      await logEdgeError({
        functionName: "register-push-subscription",
        title: "Push token registration unauthorized",
        error: new Error("Missing or invalid user session"),
        severity: "warning",
        httpStatus: 401,
      });
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
    const platform: PushPlatform = body.platform === "ios" ? "ios" : "web";
    const p256dh = typeof body.p256dh === "string" ? body.p256dh : null;
    const auth = typeof body.auth === "string" ? body.auth : null;

    if (!endpoint || endpoint.length < 8) {
      console.warn(`[register-push-subscription] missing endpoint for user ${userId}`);
      return json({ error: "Missing endpoint" }, 400);
    }

    if (platform === "web" && (!p256dh || !auth)) {
      console.warn(`[register-push-subscription] missing web keys for user ${userId}`);
      return json({ error: "Missing web push keys" }, 400);
    }

    const svc = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // CRITICAL: take over this endpoint from any other user account that
    // previously registered it on this device. Without this, pushes destined
    // for the previous user still hit the current device's APNs/browser token.
    const { error: takeoverError } = await svc
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .neq("user_id", userId);

    if (takeoverError) {
      console.error("[register-push-subscription] endpoint takeover failed:", takeoverError);
      await logEdgeError({
        functionName: "register-push-subscription",
        title: "Push endpoint takeover failed",
        error: takeoverError,
        severity: "warning",
        userId,
        context: { platform },
      });
    }

    if (platform === "ios") {
      const { error: deleteError } = await svc
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("platform", "ios")
        .neq("endpoint", endpoint);

      if (deleteError) {
        console.error("[register-push-subscription] iOS stale cleanup failed:", deleteError);
        await logEdgeError({
          functionName: "register-push-subscription",
          title: "iOS stale push token cleanup failed",
          error: deleteError,
          severity: "warning",
          userId,
          context: { platform },
        });
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
      await logEdgeError({
        functionName: "register-push-subscription",
        title: "Push token save failed",
        error: upsertError,
        severity: "error",
        userId,
        context: { platform },
        httpStatus: 500,
      });
      return json({ error: "Failed to save push subscription" }, 500);
    }

    const { data: savedRows, error: savedRowsError } = await svc
      .from("push_subscriptions")
      .select("id, platform, updated_at")
      .eq("user_id", userId)
      .eq("platform", platform)
      .order("updated_at", { ascending: false });

    if (savedRowsError) {
      console.warn("[register-push-subscription] saved but status check failed:", savedRowsError);
    }

    console.log(`[register-push-subscription] saved ${platform} token for user ${userId} endpoint=${endpoint.slice(0, 16)}…`);
    return json({
      ok: true,
      platform,
      token_count_for_platform: savedRows?.length ?? null,
      latest_updated_at: savedRows?.[0]?.updated_at ?? null,
    });
  } catch (err) {
    console.error("[register-push-subscription] error:", err);
    await logEdgeError({
      functionName: "register-push-subscription",
      title: "Push token registration crashed",
      error: err,
      severity: "error",
      httpStatus: 500,
    });
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});