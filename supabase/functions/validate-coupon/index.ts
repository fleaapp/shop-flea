import { rejectUntrustedOrigin } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkRateLimit, callerKey, tooManyRequests } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const originBlock = rejectUntrustedOrigin(req);
  if (originBlock) return originBlock;
  try {
    // Rate limit: 30 validation attempts per IP per minute.
    if (!(await checkRateLimit(callerKey(req, "validate-coupon"), 30, 60))) {
      return tooManyRequests(corsHeaders, "Too many coupon attempts. Please wait a moment.");
    }

    const { code } = await req.json();
    const normalized = String(code || "").trim().toUpperCase();
    if (!normalized || normalized.length > 40) {
      return json({ valid: false, message: "Enter a valid coupon code." });
    }

    // Read from External Supabase — same source of truth used by
    // stripe-connect-payment-intent and stripe-connect-checkout, so a coupon
    // that validates here is guaranteed to apply at charge time.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: c } = await supabase
      .from("coupons")
      .select("code, type, active, starts_at, expires_at, max_redemptions, redemption_count, description")
      .eq("code", normalized)
      .maybeSingle();

    if (!c || !c.active) {
      return json({ valid: false, message: "Invalid or expired code." });
    }
    const now = Date.now();
    if (c.starts_at && new Date(c.starts_at).getTime() > now) {
      return json({ valid: false, message: "Invalid or expired code." });
    }
    if (c.expires_at && new Date(c.expires_at).getTime() < now) {
      return json({ valid: false, message: "Invalid or expired code." });
    }
    if (c.max_redemptions !== null && c.redemption_count >= c.max_redemptions) {
      return json({ valid: false, message: "This code has reached its limit." });
    }

    const message =
      c.type === "waive_buyer_fee"
        ? "Buyer fees waived at checkout."
        : c.description || "Discount applied.";

    return json({ valid: true, code: c.code, type: c.type, message });
  } catch (e) {
    return json({ valid: false, message: "Could not validate code." }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
