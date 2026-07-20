// One-shot migration: External Supabase → Lovable Cloud
// Migrates auth.users (with password_hash + UUID preserved) from external into Cloud.
// Public.* tables are handled separately via psql after this runs.
//
// Idempotent: skips users that already exist on Cloud.
// Requires EXTERNAL_SUPABASE_URL + EXTERNAL_SUPABASE_SERVICE_ROLE_KEY secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Danger-token guard — must be POSTed with { token: "MIGRATE_2026_07_20" }.
const GUARD_TOKEN = "MIGRATE_2026_07_20";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if (body.token !== GUARD_TOKEN) {
      return json({ error: "forbidden" }, 403);
    }

    const cloudUrl = Deno.env.get("SUPABASE_URL")!;
    const cloudKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const extUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const extKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;

    if (!cloudUrl || !cloudKey || !extUrl || !extKey) {
      return json({ error: "missing env" }, 500);
    }

    const cloud = createClient(cloudUrl, cloudKey, { auth: { persistSession: false } });
    const ext = createClient(extUrl, extKey, { auth: { persistSession: false } });

    const mode = body.mode || "migrate"; // "migrate" | "wipe_cloud_users" | "list"

    if (mode === "list") {
      const { data: cloudUsers } = await cloud.auth.admin.listUsers({ perPage: 200 });
      const { data: extUsers } = await ext.auth.admin.listUsers({ perPage: 200 });
      return json({
        cloud: cloudUsers?.users.map((u) => ({ id: u.id, email: u.email })),
        external: extUsers?.users.map((u) => ({ id: u.id, email: u.email })),
      });
    }

    if (mode === "wipe_cloud_users") {
      const { data: cloudUsers } = await cloud.auth.admin.listUsers({ perPage: 200 });
      const results: any[] = [];
      for (const u of cloudUsers?.users ?? []) {
        const { error } = await cloud.auth.admin.deleteUser(u.id);
        results.push({ id: u.id, email: u.email, error: error?.message ?? null });
      }
      return json({ wiped: results });
    }

    // Default: migrate external users → cloud, preserving UUIDs.
    // Uses raw admin REST (POST /auth/v1/admin/users with `id` + `password_hash`).
    const { data: extUsers, error: extErr } = await ext.auth.admin.listUsers({ perPage: 200 });
    if (extErr) return json({ error: "list external failed", detail: extErr.message }, 500);

    // Fetch encrypted_password hashes directly via a service-role SQL call — admin.listUsers strips them.
    const hashRes = await fetch(`${extUrl}/rest/v1/rpc/get_all_user_hashes`, {
      method: "POST",
      headers: {
        apikey: extKey,
        Authorization: `Bearer ${extKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const hashRows: Array<{ id: string; encrypted_password: string | null; email: string }> =
      hashRes.ok ? await hashRes.json() : [];
    const hashById = new Map(hashRows.map((r) => [r.id, r.encrypted_password]));

    const results: any[] = [];

    for (const u of extUsers?.users ?? []) {
      // Skip signup-test-* junk accounts
      if (u.email?.startsWith("signup-test-")) {
        results.push({ id: u.id, email: u.email, skipped: "signup test account" });
        continue;
      }

      const payload: any = {
        id: u.id,
        email: u.email,
        email_confirm: !!u.email_confirmed_at,
        phone: u.phone || undefined,
        phone_confirm: !!u.phone_confirmed_at,
        user_metadata: u.user_metadata ?? {},
        app_metadata: u.app_metadata ?? {},
      };

      const hash = hashById.get(u.id);
      if (hash) {
        payload.password_hash = hash;
      } else {
        // No password hash (e.g. OAuth-only user). Skip password; user must reset or re-OAuth.
      }

      const resp = await fetch(`${cloudUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: cloudKey,
          Authorization: `Bearer ${cloudKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const respBody = await resp.text();
      results.push({
        id: u.id,
        email: u.email,
        status: resp.status,
        ok: resp.ok,
        hadHash: !!hash,
        response: resp.ok ? "created" : respBody.slice(0, 500),
      });
    }

    return json({ migrated: results });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
