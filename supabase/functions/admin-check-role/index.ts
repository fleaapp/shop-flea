import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "https://dzglehiopfgfjmxtejve.supabase.co";
const EXTERNAL_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z2xlaGlvcGZnZmpteHRlanZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzI0MjUsImV4cCI6MjA4NDU0ODQyNX0.qfOBjubnuod5iGF_G_gH2ZhMDJ1fVwAO9p5BZSxG0xI";
const EXTERNAL_SERVICE_ROLE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const verifier = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await getUserId(req);
  if (!userId) {
    return new Response(JSON.stringify({ isAdmin: false, reason: "no-auth" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  try {
    const client = createClient(EXTERNAL_URL, EXTERNAL_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (error) {
      // Log details server-side only; return generic message to client.
      console.error("admin-check-role query error", { userId, code: error.code, message: error.message, details: error.details });
      return new Response(JSON.stringify({ isAdmin: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ isAdmin: Boolean(data) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("admin-check-role failed", e);
    return new Response(JSON.stringify({ isAdmin: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
