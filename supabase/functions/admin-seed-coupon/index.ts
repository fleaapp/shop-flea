// One-off admin function: upsert FREEFLEA into the External coupons table.
// Uses raw REST fetch with EXTERNAL_SUPABASE_SERVICE_ROLE_KEY to bypass PGRST204
// column-cache issues, per the project's persistence rule.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;

  const body = {
    code: "FREEFLEA",
    type: "waive_buyer_fee",
    active: true,
    description: "Buyer fees waived at checkout.",
    starts_at: null,
    expires_at: null,
    max_redemptions: null,
    redemption_count: 0,
  };

  // Upsert on code (unique)
  const res = await fetch(`${url}/rest/v1/coupons?on_conflict=code`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return new Response(
    JSON.stringify({ status: res.status, body: text }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
