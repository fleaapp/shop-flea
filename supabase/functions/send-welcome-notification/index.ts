import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WELCOME_TITLE = "Welcome to Flea!";
const WELCOME_MESSAGE =
  "Welcome to Flea! 👉👚👟♻️ Use code 'FREEFLEA' for no fees on your first purchase!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Manual JWT parse — we only need the caller's own id.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload?.sub ?? null;
    } catch {
      userId = null;
    }
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Idempotency: one welcome per account, ever.
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "welcome")
      .limit(1)
      .maybeSingle();

    if (existing) return json({ ok: true, alreadySent: true });

    // Always create the in-app alert, regardless of push permission.
    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: userId,
      type: "welcome",
      title: WELCOME_TITLE,
      message: WELCOME_MESSAGE,
      is_read: false,
    });
    if (insertError) {
      console.error("[welcome] alert insert failed:", insertError);
      return json({ error: insertError.message }, 500);
    }

    // Best-effort push on top of the alert.
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          user_id: userId,
          notification: {
            type: "welcome",
            title: WELCOME_TITLE,
            message: WELCOME_MESSAGE,
          },
        }),
      });
    } catch (pushErr) {
      console.warn("[welcome] push send failed (alert still created):", pushErr);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("[welcome] unexpected error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
