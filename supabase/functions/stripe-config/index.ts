// Returns Stripe publishable key (public value, safe for client).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({ publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});
