import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let sql: any;
  try {
    const dbUrl = Deno.env.get("EXTERNAL_SUPABASE_DB_URL") ?? "";
    if (!dbUrl) throw new Error("EXTERNAL_SUPABASE_DB_URL missing");
    console.log("[create-saved-searches-table] connecting…");
    sql = postgres(dbUrl, { max: 1, prepare: false, ssl: "require", connect_timeout: 15 });
    console.log("[create-saved-searches-table] running DDL…");
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS public.saved_searches (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL,
        query TEXT NOT NULL,
        filters JSONB NOT NULL DEFAULT '{}'::jsonb,
        region_id TEXT,
        last_notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_user_query_unique
        ON public.saved_searches (user_id, lower(query));
      CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx ON public.saved_searches (user_id);
      CREATE INDEX IF NOT EXISTS saved_searches_region_idx ON public.saved_searches (region_id);
      ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
    `);
    await sql.unsafe(`DROP POLICY IF EXISTS "Users view their saved searches" ON public.saved_searches;`);
    await sql.unsafe(`CREATE POLICY "Users view their saved searches" ON public.saved_searches FOR SELECT USING (auth.uid() = user_id);`);
    await sql.unsafe(`DROP POLICY IF EXISTS "Users insert their saved searches" ON public.saved_searches;`);
    await sql.unsafe(`CREATE POLICY "Users insert their saved searches" ON public.saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);`);
    await sql.unsafe(`DROP POLICY IF EXISTS "Users update their saved searches" ON public.saved_searches;`);
    await sql.unsafe(`CREATE POLICY "Users update their saved searches" ON public.saved_searches FOR UPDATE USING (auth.uid() = user_id);`);
    await sql.unsafe(`DROP POLICY IF EXISTS "Users delete their saved searches" ON public.saved_searches;`);
    await sql.unsafe(`CREATE POLICY "Users delete their saved searches" ON public.saved_searches FOR DELETE USING (auth.uid() = user_id);`);
    await sql.unsafe(`NOTIFY pgrst, 'reload schema';`);
    console.log("[create-saved-searches-table] done.");
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[create-saved-searches-table] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (sql) {
      try { await sql.end({ timeout: 5 }); } catch {}
    }
  }
});
