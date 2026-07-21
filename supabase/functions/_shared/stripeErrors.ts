// Shared helpers for classifying Stripe errors in edge functions.
// Primary use: detect when a restricted key (rk_live_...) lacks a required
// permission scope so we can degrade gracefully instead of returning 500.

export interface StripeErrorLike {
  type?: string;
  code?: string;
  statusCode?: number;
  message?: string;
  raw?: { message?: string; code?: string };
}

/** True when the error is a Stripe restricted-key scope / permission problem. */
export function isStripePermissionError(err: unknown): boolean {
  const e = err as StripeErrorLike;
  if (!e) return false;
  const msg = (e.message || e.raw?.message || "").toLowerCase();
  if (e.type === "StripePermissionError") return true;
  if (e.statusCode === 403) return true;
  if (msg.includes("does not have the required permissions")) return true;
  if (msg.includes("permission denied")) return true;
  return false;
}

/** Best-effort extraction of the missing scope name from the Stripe message. */
export function extractMissingScope(err: unknown): string | null {
  const e = err as StripeErrorLike;
  const msg = e?.message || e?.raw?.message || "";
  const m = msg.match(/\(['"]?([a-z_]+_(?:read|write))['"]?\)/i);
  return m?.[1] ?? null;
}

/** Async logger — writes a structured row into public.error_logs, best effort. */
export async function logStripeScopeGap(
  serviceClient: any,
  functionName: string,
  err: unknown,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    const scope = extractMissingScope(err);
    const message = (err as StripeErrorLike)?.message || String(err);
    await serviceClient.from("error_logs").insert({
      source: functionName,
      code: "stripe_key_scope_missing",
      message: scope
        ? `Restricted key missing scope: ${scope}`
        : "Restricted key missing a Stripe permission",
      details: { scope, raw: message, ...(extra || {}) },
    });
  } catch (_) {
    // never let logging failures crash the caller
  }
}
