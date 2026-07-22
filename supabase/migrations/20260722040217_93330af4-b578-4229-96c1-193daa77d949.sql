
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bundle_shipping_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS bundle_shipping_discount_percent integer;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bundle_shipping_mode_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bundle_shipping_mode_check
  CHECK (bundle_shipping_mode IN ('none','discounted','free'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bundle_shipping_discount_percent_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bundle_shipping_discount_percent_check
  CHECK (bundle_shipping_discount_percent IS NULL OR bundle_shipping_discount_percent IN (10,20,30,40,50));

DROP VIEW IF EXISTS public.profiles_public;
DROP FUNCTION IF EXISTS public.get_profiles_public();

CREATE OR REPLACE FUNCTION public.get_profiles_public()
 RETURNS TABLE(id uuid, user_id uuid, username text, avatar_url text, location text, country_code text, region_id text, rating numeric, total_reviews integer, pause_selling boolean, tiered_shipping_enabled boolean, shipping_tier_1 numeric, shipping_tier_2 numeric, shipping_tier_3 numeric, bundle_shipping_mode text, bundle_shipping_discount_percent integer, shipping_preferences_set boolean, stripe_onboarding_complete boolean, paypal_onboarding_complete boolean, status text, last_sign_in_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.user_id, p.username, p.avatar_url, p.location, p.country_code, p.region_id,
    p.rating, p.total_reviews, p.pause_selling,
    p.tiered_shipping_enabled, p.shipping_tier_1, p.shipping_tier_2, p.shipping_tier_3,
    p.bundle_shipping_mode, p.bundle_shipping_discount_percent,
    p.shipping_preferences_set, p.stripe_onboarding_complete, p.paypal_onboarding_complete,
    p.status, p.last_sign_in_at, p.created_at, p.updated_at
  FROM public.profiles p
$function$;

CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT * FROM public.get_profiles_public();

GRANT SELECT ON public.profiles_public TO anon, authenticated;
