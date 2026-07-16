// Returns Stripe publishable key (public value, safe for client).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYMENT_DOMAIN_ALLOWLIST = new Set([
  "app.finditonflea.com",
  "shop-flea.lovable.app",
  "id-preview--1d934446-72c7-4973-9378-0721cb47807c.lovable.app",
]);

const ensurePaymentMethodDomain = async (req: Request) => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!stripeKey) return;

  const origin = req.headers.get("origin") || "";
  let hostname = "";
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return;
  }

  if (!PAYMENT_DOMAIN_ALLOWLIST.has(hostname)) return;

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  try {
    const existing = await stripe.paymentMethodDomains.list({ domain_name: hostname, limit: 1 });
    const domain = existing.data[0];
    if (!domain) {
      await stripe.paymentMethodDomains.create({ domain_name: hostname });
    } else if (!domain.enabled) {
      await stripe.paymentMethodDomains.update(domain.id, { enabled: true });
    }
  } catch (error) {
    console.warn("[stripe-config] payment domain registration skipped:", (error as Error).message);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  await ensurePaymentMethodDomain(req);
  return new Response(
    JSON.stringify({ publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});
