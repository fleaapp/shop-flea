// Shared CORS helper with an origin allow-list.
//
// Money-moving and admin endpoints must not be callable from arbitrary
// websites. Browsers send an `Origin` header on cross-site requests; native
// (Capacitor) builds send either no origin or a capacitor:// origin.

const ALLOWED_ORIGINS = new Set<string>([
  "https://shop-flea.lovable.app",
  "https://app.finditonflea.com",
  "https://finditonflea.com",
  "https://www.finditonflea.com",
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "http://localhost:8080",
  "http://localhost:5173",
]);

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

/** True when the origin is trusted (or absent, e.g. native / server-to-server). */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Lovable preview/sandbox domains for this project.
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:") return false;
    return hostname.endsWith(".lovable.app") || hostname.endsWith(".lovableproject.com");
  } catch {
    return false;
  }
}

/**
 * CORS headers scoped to the request's origin. Falls back to the primary app
 * origin when the caller is untrusted, so the browser blocks the response.
 */
export function buildCorsHeaders(
  req: Request,
  methods = "POST, OPTIONS",
): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "https://app.finditonflea.com",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Returns a 403 response when the caller's origin is not trusted, otherwise
 * null. Call this immediately after the OPTIONS preflight handler.
 */
export function rejectUntrustedOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (isAllowedOrigin(origin)) return null;
  return new Response(JSON.stringify({ error: "Origin not allowed" }), {
    status: 403,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}
