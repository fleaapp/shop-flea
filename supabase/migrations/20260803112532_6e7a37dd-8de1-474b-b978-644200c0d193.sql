ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bundle_item_discount_percent integer;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bundle_shipping_mode_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bundle_shipping_mode_check
  CHECK (bundle_shipping_mode IN ('none','discounted','free','item_discount'));

ALTER TABLE public.profiles_public
  ADD COLUMN IF NOT EXISTS bundle_item_discount_percent integer;

CREATE OR REPLACE FUNCTION public.sync_profiles_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles_public (
    id, user_id, username, avatar_url, location, country_code, region_id,
    rating, total_reviews, pause_selling,
    tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3,
    bundle_shipping_mode, bundle_shipping_discount_percent, bundle_item_discount_percent,
    shipping_preferences_set,
    stripe_onboarding_complete, paypal_onboarding_complete,
    status, last_sign_in_at, created_at, updated_at, offers_enabled
  )
  VALUES (
    NEW.id, NEW.user_id, NEW.username, NEW.avatar_url, NEW.location, NEW.country_code, NEW.region_id,
    NEW.rating, NEW.total_reviews, NEW.pause_selling,
    NEW.tiered_shipping_enabled, NEW.shipping_tier_1, NEW.shipping_tier_2, NEW.shipping_tier_3,
    NEW.bundle_shipping_mode, NEW.bundle_shipping_discount_percent, NEW.bundle_item_discount_percent,
    NEW.shipping_preferences_set,
    NEW.stripe_onboarding_complete, NEW.paypal_onboarding_complete,
    NEW.status, NEW.last_sign_in_at, NEW.created_at, NEW.updated_at, NEW.offers_enabled
  )
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    location = EXCLUDED.location,
    country_code = EXCLUDED.country_code,
    region_id = EXCLUDED.region_id,
    rating = EXCLUDED.rating,
    total_reviews = EXCLUDED.total_reviews,
    pause_selling = EXCLUDED.pause_selling,
    tiered_shipping_enabled = EXCLUDED.tiered_shipping_enabled,
    shipping_tier_1 = EXCLUDED.shipping_tier_1,
    shipping_tier_2 = EXCLUDED.shipping_tier_2,
    shipping_tier_3 = EXCLUDED.shipping_tier_3,
    bundle_shipping_mode = EXCLUDED.bundle_shipping_mode,
    bundle_shipping_discount_percent = EXCLUDED.bundle_shipping_discount_percent,
    bundle_item_discount_percent = EXCLUDED.bundle_item_discount_percent,
    shipping_preferences_set = EXCLUDED.shipping_preferences_set,
    stripe_onboarding_complete = EXCLUDED.stripe_onboarding_complete,
    paypal_onboarding_complete = EXCLUDED.paypal_onboarding_complete,
    status = EXCLUDED.status,
    last_sign_in_at = EXCLUDED.last_sign_in_at,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    offers_enabled = EXCLUDED.offers_enabled;
  RETURN NEW;
END;
$$;

UPDATE public.profiles_public pp
SET bundle_item_discount_percent = p.bundle_item_discount_percent
FROM public.profiles p
WHERE p.user_id = pp.user_id;