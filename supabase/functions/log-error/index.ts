// Public endpoint that ingests runtime errors from the app and edge functions,
// storing them in public.error_logs on the external Supabase (source of truth).
// The table is created lazily so no separate migration is required.
import { rejectUntrustedOrigin } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { getVerifiedUserId } from '../_shared/auth.ts';
import { matchesServiceCredential } from '../_shared/internalAuth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

let schemaReady = false;
async function ensureSchema(sql: ReturnType<typeof postgres>) {
  if (schemaReady) return;
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
  await sql`CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON public.error_logs (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS error_logs_source_idx ON public.error_logs (source)`;
  await sql`CREATE INDEX IF NOT EXISTS error_logs_dedupe_recent_idx ON public.error_logs (dedupe_key, created_at DESC) WHERE dedupe_key IS NOT NULL`;
  schemaReady = true;
}

const truncate = (v: unknown, max: number): string | null => {
  if (v == null) return null;
  const s = typeof v === "string" ? v : String(v);
  return s.slice(0, max);
};

const clampJson = (v: unknown, maxBytes = 4000): unknown => {
  if (v == null || typeof v !== "object") return v ?? null;
  try {
    const s = JSON.stringify(v);
    if (s.length <= maxBytes) return v;
    return { _truncated: true, preview: s.slice(0, maxBytes) };
  } catch { return null; }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const originBlock = rejectUntrustedOrigin(req);
  if (originBlock) return originBlock;
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    if (!DB_URL) throw new Error("DB URL not set");
    const body = await req.json().catch(() => ({} as any));

    const isTrustedServer = matchesServiceCredential(req.headers.get('Authorization'), SERVICE_KEY);
    const source = isTrustedServer && ["client","edge_function","payment","auth"].includes(body.source)
      ? body.source : body.source === 'auth' ? 'auth' : 'client';
    const severity = ["warning","error","critical"].includes(body.severity) ? body.severity : "error";
    if (severity === "warning") {
      return new Response(JSON.stringify({ ok: true, skipped: "warning" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const title = truncate(body.title, 200) ?? "Unknown error";
    const message = truncate(body.message, 2000) ?? "";
    const stack = truncate(body.stack, 8000);
    const route = truncate(body.route, 500);
    const device = clampJson(body.device);
    const context = clampJson(body.context);
    const dedupe = truncate(body.dedupe_key, 200);

    // Attribution rules:
    //  - client/auth: only from the caller's verified login token (never body).
    //  - edge_function/payment: a body-supplied user_id is only trusted when the
    //    caller proves it is server-side by presenting the service-role key.
    let userId: string | null = null;
    let username: string | null = null;
    if (isTrustedServer) {
      const candidate = typeof body.user_id === "string" ? body.user_id : null;
      if (candidate && /^[0-9a-f-]{36}$/i.test(candidate)) userId = candidate;
    } else {
      userId = await getVerifiedUserId(req);
    }
    if (isTrustedServer && typeof body.username === "string") username = truncate(body.username, 80);

    const sql = postgres(DB_URL, { max: 1 });
    try {
      await ensureSchema(sql);

      // Dedupe: same key within last 5 minutes -> skip insert.
      if (dedupe) {
        const [existing] = await sql`
          SELECT id FROM public.error_logs
          WHERE dedupe_key = ${dedupe}
            AND created_at > now() - interval '5 minutes'
          ORDER BY created_at DESC LIMIT 1
        `;
        if (existing) {
          return new Response(JSON.stringify({ ok: true, deduped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Fill username from profiles if not provided but user_id known.
      if (!username && userId) {
        try {
          const [row] = await sql`SELECT username FROM public.profiles WHERE user_id = ${userId} LIMIT 1`;
          if (row?.username) username = String(row.username).slice(0, 80);
        } catch {}
      }

      const [inserted] = await sql`
        INSERT INTO public.error_logs (
          source, severity, user_id, username, title, message, stack, route, device, context, dedupe_key
        ) VALUES (
          ${source}, ${severity}, ${userId}, ${username}, ${title}, ${message},
          ${stack}, ${route}, ${device as any}, ${context as any}, ${dedupe}
        )
        RETURNING id
      `;

      return new Response(JSON.stringify({ ok: true, id: inserted?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      await sql.end({ timeout: 1 }).catch(() => {});
    }
  } catch (e) {
    console.error("[log-error] failed:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
