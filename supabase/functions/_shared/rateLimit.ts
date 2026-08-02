// Shared rate limiter backed by the `check_and_record_rate_limit` database
// function. Fails open so a database hiccup never blocks a genuine payment.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return true;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_and_record_rate_limit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ _key: key, _max: max, _window_seconds: windowSeconds }),
    });
    if (!res.ok) return true;
    return (await res.json()) === true;
  } catch {
    return true;
  }
}

/** Best-effort caller fingerprint for anonymous/pre-auth rate limiting. */
export function callerKey(req: Request, prefix: string, userId?: string | null): string {
  if (userId) return `${prefix}:user:${userId}`;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  return `${prefix}:ip:${ip}`;
}

export function tooManyRequests(
  corsHeaders: Record<string, string>,
  message = "Too many requests. Please wait a moment and try again.",
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
