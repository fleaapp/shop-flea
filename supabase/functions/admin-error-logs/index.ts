// Admin-only endpoint that lists and manages runtime error logs stored on the
// external Supabase. Returns paginated, filtered results for the admin dashboard.
import { rejectUntrustedOrigin } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_URL = Deno.env.get("SUPABASE_URL") ?? "";
const EXTERNAL_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const EXTERNAL_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? Deno.env.get("SUPABASE_DB_URL") ?? "";

async function isAdmin(auth: string | null): Promise<{ userId: string; isAdmin: boolean } | null> {
  if (!auth || !EXTERNAL_URL || !EXTERNAL_ANON || !EXTERNAL_SR) return null;
  try {
    const verifier = createClient(EXTERNAL_URL, EXTERNAL_ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await verifier.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return null;
    const admin = createClient(EXTERNAL_URL, EXTERNAL_SR, { auth: { persistSession: false } });
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { userId, isAdmin: Boolean(data) };
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const originBlock = rejectUntrustedOrigin(req);
  if (originBlock) return originBlock;
  try {
    const auth = req.headers.get("Authorization");
    const check = await isAdmin(auth);
    if (!check?.isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!DB_URL) throw new Error("DB URL not set");

    const body = await req.json().catch(() => ({} as any));
    const action = body.action || "list";
    const sql = postgres(DB_URL, { max: 1 });
    try {
      // Ensure schema exists in case log-error hasn't been called yet.
      await sql`
        CREATE TABLE IF NOT EXISTS public.error_logs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at timestamptz NOT NULL DEFAULT now(),
          source text NOT NULL,
          severity text NOT NULL DEFAULT 'error',
          user_id uuid NULL,
          username text NULL,
          title text NOT NULL,
          message text NOT NULL,
          stack text NULL,
          route text NULL,
          device jsonb NULL,
          context jsonb NULL,
          dedupe_key text NULL
        )
      `;

      if (action === "delete") {
        const id = body.id;
        if (!id || typeof id !== "string") throw new Error("id required");
        await sql`DELETE FROM public.error_logs WHERE id = ${id}`;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "clear") {
        // Delete anything older than 30 days as a manual purge.
        const olderThanHours = typeof body.olderThanHours === "number" ? body.olderThanHours : 24 * 30;
        await sql`DELETE FROM public.error_logs WHERE created_at < now() - (${olderThanHours}::text || ' hours')::interval`;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "count24h") {
        const since = typeof body.since === "string" && body.since ? body.since : null;
        const [row] = since
          ? await sql`SELECT COUNT(*)::int AS c FROM public.error_logs WHERE created_at > ${since}::timestamptz AND severity <> 'warning'`
          : await sql`SELECT COUNT(*)::int AS c FROM public.error_logs WHERE created_at > now() - interval '24 hours' AND severity <> 'warning'`;
        return new Response(JSON.stringify({ count: row?.c ?? 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Default: list
      const source = typeof body.source === "string" && body.source !== "all" ? body.source : null;
      const severity = typeof body.severity === "string" && body.severity !== "all" ? body.severity : null;
      const search = typeof body.search === "string" && body.search.trim() ? `%${body.search.trim().slice(0, 200)}%` : null;
      const sinceHours = Number.isFinite(body.sinceHours) ? Number(body.sinceHours) : 24 * 7;
      const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 500);
      const offset = Math.max(Number(body.offset) || 0, 0);

      const rows = await sql`
        SELECT id, created_at, source, severity, user_id, username, title, message, stack, route, device, context
        FROM public.error_logs
        WHERE created_at > now() - (${sinceHours}::text || ' hours')::interval
          AND severity <> 'warning'
          AND (${source}::text IS NULL OR source = ${source})
          AND (${severity}::text IS NULL OR severity = ${severity})
          AND (${search}::text IS NULL OR title ILIKE ${search} OR message ILIKE ${search} OR username ILIKE ${search})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return new Response(JSON.stringify({ rows }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      await sql.end({ timeout: 1 }).catch(() => {});
    }
  } catch (e) {
    console.error("[admin-error-logs] failed:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
