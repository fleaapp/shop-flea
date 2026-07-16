// One-off admin function: create the `coupons` and `coupon_redemptions` tables
// in the External database (if missing) and upsert FREEFLEA. This is the source
// of truth for stripe-connect-payment-intent, stripe-connect-checkout, and
// validate-coupon.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const dbUrl = Deno.env.get("EXTERNAL_SUPABASE_DB_URL") ?? "";
    if (!dbUrl) throw new Error("EXTERNAL_SUPABASE_DB_URL not set");

    const sql = postgres(dbUrl, { max: 1 });
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.coupons (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          code text UNIQUE NOT NULL,
          type text NOT NULL,
          description text,
          active boolean NOT NULL DEFAULT true,
          starts_at timestamptz,
          expires_at timestamptz,
          max_redemptions integer,
          redemption_count integer NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`GRANT SELECT ON public.coupons TO anon, authenticated`;
      await sql`GRANT ALL ON public.coupons TO service_role`;
      await sql`ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY`;
      // Public read of active coupons so validate-coupon works without auth.
      await sql`DROP POLICY IF EXISTS "coupons_public_read" ON public.coupons`;
      await sql`
        CREATE POLICY "coupons_public_read" ON public.coupons
        FOR SELECT USING (active = true)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
          user_id uuid,
          checkout_reference text,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (coupon_id, checkout_reference)
        )
      `;
      await sql`GRANT SELECT, INSERT ON public.coupon_redemptions TO authenticated`;
      await sql`GRANT ALL ON public.coupon_redemptions TO service_role`;
      await sql`ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY`;
      await sql`DROP POLICY IF EXISTS "coupon_redemptions_own" ON public.coupon_redemptions`;
      await sql`
        CREATE POLICY "coupon_redemptions_own" ON public.coupon_redemptions
        FOR SELECT USING (auth.uid() = user_id)
      `;

      // Upsert FREEFLEA
      await sql`
        INSERT INTO public.coupons (code, type, description, active)
        VALUES ('FREEFLEA', 'waive_buyer_fee', 'Buyer fees waived at checkout.', true)
        ON CONFLICT (code) DO UPDATE
          SET type = EXCLUDED.type,
              description = EXCLUDED.description,
              active = true,
              updated_at = now()
      `;

      try { await sql`NOTIFY pgrst, 'reload schema'`; } catch (_) {}

      const rows = await sql`SELECT code, type, active, redemption_count FROM public.coupons`;
      return new Response(JSON.stringify({ success: true, coupons: rows }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      await sql.end();
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
