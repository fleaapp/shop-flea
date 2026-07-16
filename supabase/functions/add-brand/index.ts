const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
const externalAnonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
const cloudUrl = Deno.env.get("SUPABASE_URL") ?? "";
const cloudServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const brandSelect = "id,brand_name,display_name,usage_count,created_at";

const cloudRest = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${cloudUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cloudServiceRoleKey,
      Authorization: `Bearer ${cloudServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    console.error("brand cloud rest failed", res.status, body ?? text);
    throw new Error(typeof body?.message === "string" ? body.message : "Brand service failed.");
  }

  return body;
};

const getExternalUser = async (authHeader: string) => {
  const userRes = await fetch(`${externalUrl}/auth/v1/user`, {
    headers: { apikey: externalAnonKey, Authorization: authHeader },
  });

  if (!userRes.ok) return null;
  return userRes.json();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    if (!externalUrl || !externalAnonKey || !cloudUrl || !cloudServiceRoleKey) {
      return json({ error: "Brand service is not configured." }, 500);
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
      const params = new URLSearchParams({ select: brandSelect, order: "display_name.asc", limit: "1000" });
      const rows = await cloudRest(`brands?${params.toString()}`) as unknown[];
      const brands = search
        ? rows.filter((brand: any) =>
            (brand.brand_name ?? "").toLowerCase().includes(search) ||
            (brand.display_name ?? "").toLowerCase().includes(search)
          )
        : rows;
      return json({ brands });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Sign in required." }, 401);
    }

    const user = await getExternalUser(authHeader);
    if (!user?.id) {
      return json({ error: "Sign in required." }, 401);
    }

    const { displayName } = await req.json().catch(() => ({ displayName: "" }));
    const trimmed = String(displayName ?? "").trim();
    const brandName = normalizeBrandName(trimmed);

    if (!trimmed || !brandName || trimmed.length > 100 || brandName.length > 100) {
      return json({ error: "Enter a valid brand name." }, 400);
    }

    // Check for existing brand first (case-insensitive)
    const existingParams = new URLSearchParams({
      select: brandSelect,
      brand_name: `ilike.${brandName}`,
      limit: "1",
    });
    const existingRows = await cloudRest(`brands?${existingParams.toString()}`) as any[];
    const existing = existingRows[0];

    if (existing) return json({ brand: existing });

    try {
      const insertParams = new URLSearchParams({ select: brandSelect });
      const inserted = await cloudRest(`brands?${insertParams.toString()}`, {
        method: "POST",
        body: JSON.stringify({ brand_name: brandName, display_name: trimmed }),
      }) as any[];

      return json({ brand: inserted[0] });
    } catch (error) {
      // Unique-index race: re-fetch existing
      const racedRows = await cloudRest(`brands?${existingParams.toString()}`) as any[];
      const raced = racedRows[0];
      if (raced) return json({ brand: raced });
      console.error("add-brand failed", error);
      return json({ error: "Could not add brand." }, 500);
    }
  } catch (error) {
    console.error("add-brand unexpected error", error);
    return json({ error: "Could not add brand." }, 500);
  }
});