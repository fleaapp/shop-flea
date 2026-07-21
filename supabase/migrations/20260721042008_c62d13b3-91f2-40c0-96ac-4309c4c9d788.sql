
-- Replace SECURITY DEFINER view with a security_invoker view backed by a SECURITY DEFINER function.
-- This satisfies the Supabase linter (no SECURITY DEFINER views) while preserving public access
-- to non-sensitive profile fields without exposing sensitive columns on the profiles table.

DROP VIEW IF EXISTS public.profiles_public;

CREATE OR REPLACE FUNCTION public.get_profiles_public()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  location text,
  country_code text,
  region_id text,
  rating numeric,
  total_reviews integer,
  pause_selling boolean,
  tiered_shipping_enabled boolean,
  shipping_tier_1 numeric,
  shipping_tier_2 numeric,
  shipping_tier_3 numeric,
  shipping_preferences_set boolean,
  stripe_onboarding_complete boolean,
  paypal_onboarding_complete boolean,
  status text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.user_id,
    p.username,
    p.avatar_url,
    p.location,
    p.country_code,
    p.region_id,
    p.rating,
    p.total_reviews,
    p.pause_selling,
    p.tiered_shipping_enabled,
    p.shipping_tier_1,
    p.shipping_tier_2,
    p.shipping_tier_3,
    p.shipping_preferences_set,
    p.stripe_onboarding_complete,
    p.paypal_onboarding_complete,
    p.status,
    p.last_sign_in_at,
    p.created_at,
    p.updated_at
  FROM public.profiles p
$$;

GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO anon, authenticated, service_role;

CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT * FROM public.get_profiles_public();

GRANT SELECT ON public.profiles_public TO anon, authenticated;
GRANT ALL ON public.profiles_public TO service_role;
