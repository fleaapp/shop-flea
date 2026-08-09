// Shared helper for edge functions to log errors into public.error_logs on the
// external Supabase. Non-blocking — never throws, never delays the response.
const LOG_URL = (() => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  if (!url) return "";
  return `${url.replace(/\/$/, "")}/functions/v1/log-error`;
})();
// Server-to-server calls present the service-role key so log-error can trust the
// user attribution in the payload. Falls back to anon (attribution dropped).
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const AUTH_KEY = SERVICE_KEY || ANON_KEY;

type LogInput = {
  functionName: string;
  error: unknown;
  title?: string;
  severity?: "warning" | "error" | "critical";
  source?: "edge_function" | "payment" | "auth";
  userId?: string | null;
  username?: string | null;
  route?: string | null;
  context?: Record<string, unknown>;
  httpStatus?: number;
};

export async function logEdgeError(input: LogInput): Promise<void> {
  try {
    if (input.severity === "warning") return;
    if (!LOG_URL) return;
    const err = input.error as any;
    const message = err?.message ? String(err.message) : String(err ?? "Unknown error");
    const stack = err?.stack ? String(err.stack) : null;
    const title = input.title ?? `${input.functionName} failed`;
    const context = {
      function_name: input.functionName,
      http_status: input.httpStatus ?? null,
      ...(input.context ?? {}),
    };
    const body = JSON.stringify({
      source: input.source ?? "edge_function",
      severity: input.severity ?? "error",
      title,
      message,
      stack,
      route: input.route ?? `/${input.functionName}`,
      user_id: input.userId ?? null,
      username: input.username ?? null,
      context,
      dedupe_key: `${input.functionName}:${message.slice(0, 120)}`,
    });
    await fetch(LOG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body,
    }).catch(() => {});
  } catch { /* never throw */ }
}
