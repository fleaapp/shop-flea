// forward-report-to-hub
// Mirrors a report submission into the separate Flea Support Hub project so
// the moderation team has a single inbox to triage from. The local Flea
// `reports` row is the source of truth for the user-facing app (and powers
// the auto-strike trigger); this function just ALSO writes a copy into the
// Hub's Supabase project using its service role key (RLS bypass).
//
// Failure here is non-fatal — the local report still succeeded. We log
// errors but return 200 so the user UX never blocks on a Hub outage.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Body = {
  reportType: "listing" | "comment" | "user";
  entityId: string;
  ownerId: string;
  reason: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verified JWT — identifies the reporter cryptographically.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const verifier = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: claimsData, error: claimsError } = await verifier.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const reporterId = claimsData.claims.sub as string;

    const body = (await req.json()) as Body;
    const reportType = body?.reportType;
    const entityId = (body?.entityId || "").toString().trim();
    const ownerId = (body?.ownerId || "").toString().trim();
    const reason = (body?.reason || "").toString().trim().slice(0, 1000);
    if (!reportType || !entityId || !ownerId || !reason) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["listing", "comment", "user"].includes(reportType)) {
      return new Response(JSON.stringify({ error: "Invalid report type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hubUrl = Deno.env.get("HUB_SUPABASE_URL");
    const hubKey = Deno.env.get("HUB_SUPABASE_SERVICE_ROLE_KEY");
    if (!hubUrl || !hubKey) {
      // Hub not configured yet — succeed quietly so the local report flow
      // is not blocked. (Local insert is the source of truth.)
      console.warn("[forward-report-to-hub] HUB env not configured; skipping mirror");
      return new Response(JSON.stringify({ ok: true, mirrored: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insertRes = await fetch(`${hubUrl}/rest/v1/reports`, {
      method: "POST",
      headers: {
        apikey: hubKey,
        Authorization: `Bearer ${hubKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        report_type: reportType,
        reported_item_id: entityId,
        reported_user_id: ownerId,
        reporter_user_id: reporterId,
        reason,
      }),
    });

    if (!insertRes.ok) {
      const txt = await insertRes.text();
      console.error("[forward-report-to-hub] Hub insert failed:", insertRes.status, txt);
      // Non-fatal — local report is the source of truth.
      return new Response(JSON.stringify({ ok: true, mirrored: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, mirrored: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[forward-report-to-hub] error:", error);
    // Non-fatal
    return new Response(JSON.stringify({ ok: true, mirrored: false }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
