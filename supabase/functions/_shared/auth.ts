// Shared authentication helpers for edge functions.
//
// IMPORTANT: these verify the JWT signature via the auth server rather than
// naively decoding the payload. A decoded-but-unverified `sub` claim can be
// forged by anyone, so it must never be used for authorization decisions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** Returns the verified auth user id for the request, or null. */
export async function getVerifiedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await verifier.auth.getClaims(token);
    if (!error && data?.claims?.sub) return data.claims.sub as string;
  } catch (_) {
    // fall through to getUser below
  }

  try {
    const { data, error } = await verifier.auth.getUser(token);
    if (!error && data?.user?.id) return data.user.id;
  } catch (_) {
    // ignore
  }

  return null;
}

/** True when the verified user holds the `admin` role. */
export async function isAdmin(userId: string): Promise<boolean> {
  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

export type AdminGate =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

/** Verifies the caller is signed in AND holds the admin role. */
export async function requireAdmin(req: Request): Promise<AdminGate> {
  const userId = await getVerifiedUserId(req);
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };
  if (!(await isAdmin(userId))) return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true, userId };
}
