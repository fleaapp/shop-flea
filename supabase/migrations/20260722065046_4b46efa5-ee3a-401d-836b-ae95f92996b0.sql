
REVOKE SELECT ON public.profiles_public FROM anon;
GRANT SELECT (
  id, user_id, username, avatar_url, location, country_code, region_id,
  rating, total_reviews, pause_selling,
  tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3,
  bundle_shipping_mode, bundle_shipping_discount_percent,
  shipping_preferences_set, status, created_at, updated_at
) ON public.profiles_public TO anon;
