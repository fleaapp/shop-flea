// One-off admin utility to reset a user's seller onboarding state on the
// external Supabase (source of truth). Uses EXTERNAL_SUPABASE_SERVICE_ROLE_KEY
// via raw REST to bypass profiles_update_guard.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { username } = await req.json();
    if (!username) return json({ error: "username required" }, 400);
    const normalizedUsername = String(username).trim().replace(/^@/, "");

    const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    // Find profile
    const lookup = await fetch(
      `${url}/rest/v1/profiles?or=(username.eq.${encodeURIComponent(username)},username.eq.${encodeURIComponent(`@${normalizedUsername}`)},username.eq.${encodeURIComponent(normalizedUsername)})&select=user_id,username,stripe_account_id,stripe_onboarding_complete,stripe_onboarding_step`,
      { headers },
    );
    const rows = await lookup.json();
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "not found", rows }, 404);
    const before = rows[0];

    const patch = await fetch(
      `${url}/rest/v1/profiles?user_id=eq.${before.user_id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          stripe_account_id: null,
          stripe_onboarding_complete: false,
          stripe_onboarding_step: null,
        }),
      },
    );
    const after = await patch.json();
    if (!patch.ok) return json({ error: "patch failed", status: patch.status, after }, 500);

    return json({ ok: true, before, after: after?.[0] ?? after });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
