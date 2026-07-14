import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ valid: false, message: "Sign in to apply a code." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
    const ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
    const SERVICE = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const verifier = createClient(EXTERNAL_URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authErr } = await verifier.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
      return new Response(JSON.stringify({ valid: false, message: "Sign in to apply a code." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim().toUpperCase();
    if (!code || code.length > 40) {
      return new Response(
        JSON.stringify({ valid: false, message: "Please enter a code." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const svc = createClient(EXTERNAL_URL, SERVICE);
    const { data: coupon } = await svc
      .from("coupons")
      .select("id, code, type, active, starts_at, expires_at, max_redemptions, redemption_count")
      .eq("code", code)
      .maybeSingle();

    if (!coupon || !coupon.active) {
      return new Response(
        JSON.stringify({ valid: false, message: "That code isn't valid." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const now = Date.now();
    if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
      return new Response(
        JSON.stringify({ valid: false, message: "This code isn't active yet." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
      return new Response(
        JSON.stringify({ valid: false, message: "This code has expired." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    if (coupon.max_redemptions !== null && coupon.redemption_count >= coupon.max_redemptions) {
      return new Response(
        JSON.stringify({ valid: false, message: "This code has been fully redeemed." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const messageByType: Record<string, string> = {
      waive_buyer_fee: "Secure Checkout Fee waived.",
    };

    return new Response(
      JSON.stringify({
        valid: true,
        code: coupon.code,
        type: coupon.type,
        message: messageByType[coupon.type] ?? "Code applied.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    console.error("[validate-coupon]", e);
    return new Response(JSON.stringify({ valid: false, message: e?.message || "Error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
