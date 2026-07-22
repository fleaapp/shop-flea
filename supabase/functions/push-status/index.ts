import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseVerifiedUserId(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;

  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      sub?: string;
      role?: string;
      exp?: number;
    };

    if (!claims.sub || claims.role === "anon") return null;
    if (claims.exp && claims.exp * 1000 < Date.now()) return null;
    return claims.sub;
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
    const userId = parseVerifiedUserId(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const svc = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await svc
      .from("push_subscriptions")
      .select("id, platform, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const rows = data ?? [];
    const iosRows = rows.filter((row) => row.platform === "ios");

    return json({
      ok: true,
      has_ios_token: iosRows.length > 0,
      ios_token_count: iosRows.length,
      total_token_count: rows.length,
      latest_ios_updated_at: iosRows[0]?.updated_at ?? null,
    });
  } catch (err) {
    console.error("[push-status] error:", err);
    await logEdgeError({
      functionName: "push-status",
      title: "Push status check failed",
      error: err,
      severity: "warning",
      httpStatus: 500,
    });
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});