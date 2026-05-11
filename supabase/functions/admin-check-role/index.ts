import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "https://dzglehiopfgfjmxtejve.supabase.co";
const EXTERNAL_SERVICE_ROLE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { sub?: string; exp?: number };
    if (!payload.sub) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = getUserId(req);
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

    // Check if user is admin
    const { data, error } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    // If table doesn't exist, surface clearly
    if (error && (error.code === "42P01" || /relation .* does not exist/i.test(error.message ?? ""))) {
      console.error("user_roles table missing on external DB", error);
      return new Response(JSON.stringify({ isAdmin: false, error: "user_roles table missing on external DB. Run setup SQL.", code: error.code, userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (error) {
      console.error("admin-check-role query error", { userId, code: error.code, message: error.message, details: error.details });
      return new Response(JSON.stringify({ isAdmin: false, error: error.message, code: error.code, userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (data) {
      console.log("admin-check-role: existing admin", { userId });
      return new Response(JSON.stringify({ isAdmin: true, userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Not an admin — check if there are any admins at all (bootstrap path)
    const { count, error: countErr } = await client
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if (countErr) {
      console.error("admin-check-role count error", countErr);
      return new Response(JSON.stringify({ isAdmin: false, error: countErr.message, code: countErr.code, userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if ((count ?? 0) === 0) {
      // No admins exist yet — bootstrap this user as the first admin
      const { error: insertErr } = await client
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });

      if (insertErr) {
        console.error("admin bootstrap insert failed", insertErr);
        return new Response(JSON.stringify({ isAdmin: false, error: insertErr.message, code: insertErr.code, userId, bootstrap: "failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      console.log("admin-check-role: bootstrapped first admin", { userId });
      return new Response(JSON.stringify({ isAdmin: true, userId, bootstrap: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log("admin-check-role: not admin", { userId });
    return new Response(JSON.stringify({ isAdmin: false, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("admin-check-role failed", e);
    return new Response(JSON.stringify({ isAdmin: false, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
