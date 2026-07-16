import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Reloads the PostgREST schema cache on the external Supabase project
 * by connecting directly to the database and issuing NOTIFY pgrst, 'reload schema'.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const dbUrl = Deno.env.get("EXTERNAL_SUPABASE_DB_URL") ?? Deno.env.get("SUPABASE_DB_URL") ?? "";

    if (!dbUrl) {
      throw new Error("DB URL secret is not configured.");
    }

    console.log("[reload-schema] Connecting to database to reload PostgREST schema cache…");

    const sql = postgres(dbUrl, { max: 1 });

    try {
      await sql`SELECT pg_notify('pgrst', 'reload schema')`;
      console.log("[reload-schema] NOTIFY pgrst 'reload schema' sent successfully.");
    } finally {
      await sql.end();
    }

    return new Response(
      JSON.stringify({ success: true, message: "PostgREST schema cache reload triggered." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("[reload-schema] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
