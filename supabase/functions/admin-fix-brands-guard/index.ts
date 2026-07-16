// One-off admin fix: allow service_role to update brand_name/display_name on brands.
// The original brands_update_guard blocks all edits except usage_count, which
// broke admin brand renames from the admin-data edge function.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const dbUrl = Deno.env.get("EXTERNAL_SUPABASE_DB_URL") ?? Deno.env.get("SUPABASE_DB_URL") ?? "";
    if (!dbUrl) throw new Error("DB URL not set");
    const sql = postgres(dbUrl, { max: 1 });
    try {
      await sql`
        CREATE OR REPLACE FUNCTION public.brands_update_guard()
        RETURNS trigger
        LANGUAGE plpgsql
        SET search_path = public
        AS $$
        BEGIN
          IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
          IF NEW.brand_name IS DISTINCT FROM OLD.brand_name
             OR NEW.display_name IS DISTINCT FROM OLD.display_name
             OR NEW.id IS DISTINCT FROM OLD.id
             OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Only usage_count may be updated on brands';
          END IF;
          RETURN NEW;
        END;
        $$
      `;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      await sql.end();
    }
  } catch (e) {
    console.error("[admin-fix-brands-guard]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
