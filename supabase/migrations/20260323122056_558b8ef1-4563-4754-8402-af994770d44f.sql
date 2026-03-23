DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT
  id,
  user_id,
  username,
  avatar_url,
  location,
  country_code,
  region_id,
  rating,
  total_reviews,
  pause_selling,
  tiered_shipping_enabled,
  shipping_tier_1,
  shipping_tier_2,
  shipping_tier_3,
  shipping_preferences_set,
  stripe_onboarding_complete,
  paypal_onboarding_complete,
  status,
  last_sign_in_at,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;