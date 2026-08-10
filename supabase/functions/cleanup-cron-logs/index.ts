// cleanup-cron-logs
// Nightly maintenance job: purges old cron execution logs and pg_net HTTP
// response tables so they cannot grow without bound. Called via pg_cron.
//
// Retention: 7 days is enough to debug recent scheduled-job failures.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RETENTION_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const providedCron = req.headers.get("x-cron-secret") ?? "";
  const authorized =
    (!!expectedKey && authHeader === `Bearer ${expectedKey}`) ||
    (!!cronSecret && providedCron === cronSecret);

  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL") ?? "";
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "Database not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sql = postgres(dbUrl, { max: 1 });
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const cronResult = await sql`
      DELETE FROM cron.job_run_details
      WHERE start_time < ${cutoff}::timestamptz
    `;

    const netResult = await sql`
      DELETE FROM net._http_response
      WHERE created_at < ${cutoff}::timestamptz
    `;

    return new Response(
      JSON.stringify({
        ok: true,
        retention_days: RETENTION_DAYS,
        cron_rows_deleted: cronResult.count ?? 0,
        net_rows_deleted: netResult.count ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[cleanup-cron-logs] failed", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    await sql.end();
  }
});
