import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeBrandName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s&+'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Sign in required." }, 401);
    }

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
    const externalAnonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
    const cloudUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!externalUrl || !externalAnonKey || !cloudUrl || !serviceKey) {
      return json({ error: "Brand service is not configured." }, 500);
    }

    const userRes = await fetch(`${externalUrl}/auth/v1/user`, {
      headers: { apikey: externalAnonKey, Authorization: authHeader },
    });

    if (!userRes.ok) {
      return json({ error: "Sign in required." }, 401);
    }

    const { displayName } = await req.json().catch(() => ({ displayName: "" }));
    const trimmed = String(displayName ?? "").trim();
    const brandName = normalizeBrandName(trimmed);

    if (!trimmed || !brandName || trimmed.length > 100 || brandName.length > 100) {
      return json({ error: "Enter a valid brand name." }, 400);
    }

    const admin = createClient(cloudUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check for existing brand first (case-insensitive)
    const { data: existing } = await admin
      .from("brands")
      .select("id, brand_name, display_name, usage_count")
      .ilike("brand_name", brandName)
      .maybeSingle();

    if (existing) return json({ brand: existing });

    const { data, error } = await admin
      .from("brands")
      .insert({ brand_name: brandName, display_name: trimmed })
      .select("id, brand_name, display_name, usage_count")
      .single();

    if (error) {
      // Unique-index race: re-fetch existing
      const { data: raced } = await admin
        .from("brands")
        .select("id, brand_name, display_name, usage_count")
        .ilike("brand_name", brandName)
        .maybeSingle();
      if (raced) return json({ brand: raced });
      console.error("add-brand failed", error);
      return json({ error: "Could not add brand." }, 500);
    }

    return json({ brand: data });
  } catch (error) {
    console.error("add-brand unexpected error", error);
    return json({ error: "Could not add brand." }, 500);
  }
});