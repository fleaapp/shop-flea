// Admin utility: relink a user's Stripe Connect account after their
// stripe_account_id was cleared in the DB. Searches Stripe for accounts where
// metadata.flea_user_id matches, then PATCHes the profile on the external
// Supabase (source of truth) via service role.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const EXTERNAL_ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const verifier = createClient(EXTERNAL_URL, EXTERNAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authErr } = await verifier.auth.getUser(token);
    if (authErr || !authData?.user?.id) return json({ error: "Unauthorized" }, 401);
    const callerId = authData.user.id;

    // Verify admin role (mirrors admin-check-role using supabase-js)
    const svc = createClient(EXTERNAL_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: roleRow, error: roleErr } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) return json({ error: "role lookup failed", detail: roleErr.message }, 500);
    if (!roleRow) return json({ error: "Forbidden", callerId }, 403);


    const { username, accountId: providedAccountId } = await req.json();
    if (!username) return json({ error: "username required" }, 400);
    const normalized = String(username).trim().replace(/^@/, "");

    const restHeaders = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    // Find target profile
    const lookup = await fetch(
      `${EXTERNAL_URL}/rest/v1/profiles?or=(username.eq.${encodeURIComponent(`@${normalized}`)},username.eq.${encodeURIComponent(normalized)})&select=user_id,username,stripe_account_id,stripe_onboarding_complete`,
      { headers: restHeaders },
    );
    const rows = await lookup.json();
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "profile not found", rows }, 404);
    const before = rows[0];

    // Locate the Stripe account
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!.trim(), {
      apiVersion: "2025-08-27.basil",
    });

    let account: Stripe.Account | null = null;

    if (providedAccountId) {
      try {
        account = await stripe.accounts.retrieve(providedAccountId);
      } catch (e) {
        return json({ error: `Could not retrieve provided accountId: ${(e as Error).message}` }, 400);
      }
    } else {
      // Scan recent accounts and match on metadata.flea_user_id.
      let matched: Stripe.Account | null = null;
      let starting_after: string | undefined = undefined;
      for (let i = 0; i < 10 && !matched; i++) {
        const page: Stripe.ApiList<Stripe.Account> = await stripe.accounts.list({
          limit: 100,
          ...(starting_after ? { starting_after } : {}),
        });
        matched = page.data.find((a) => a.metadata?.flea_user_id === before.user_id) ?? null;
        if (!page.has_more) break;
        starting_after = page.data[page.data.length - 1]?.id;
      }
      account = matched;
    }

    if (!account) return json({ error: "No Stripe account matched flea_user_id", before }, 404);
    if (account.metadata?.flea_user_id && account.metadata.flea_user_id !== before.user_id) {
      return json({ error: "Ownership mismatch", accountMetadata: account.metadata, before }, 409);
    }

    const patchBody = {
      stripe_account_id: account.id,
      stripe_onboarding_complete: !!(account.charges_enabled && account.payouts_enabled),
    };

    const patch = await fetch(`${EXTERNAL_URL}/rest/v1/profiles?user_id=eq.${before.user_id}`, {
      method: "PATCH",
      headers: restHeaders,
      body: JSON.stringify(patchBody),
    });
    const after = await patch.json();
    if (!patch.ok) return json({ error: "patch failed", status: patch.status, after }, 500);

    return json({
      ok: true,
      before,
      restored: {
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
      },
      after: after?.[0] ?? after,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
