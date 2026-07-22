DROP VIEW IF EXISTS public.profiles_public;

CREATE TABLE IF NOT EXISTS public.profiles_public (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
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
  bundle_shipping_mode text,
  bundle_shipping_discount_percent integer,
  shipping_preferences_set boolean,
  stripe_onboarding_complete boolean,
  paypal_onboarding_complete boolean,
  status text,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);

GRANT SELECT ON public.profiles_public TO anon, authenticated;
GRANT ALL ON public.profiles_public TO service_role;

ALTER TABLE public.profiles_public ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are readable" ON public.profiles_public;
CREATE POLICY "Public profiles are readable"
ON public.profiles_public
FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.sync_profiles_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.profiles_public WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;

  INSERT INTO public.profiles_public (
    id, user_id, username, avatar_url, location, country_code, region_id,
    rating, total_reviews, pause_selling,
    tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3,
    bundle_shipping_mode, bundle_shipping_discount_percent,
    shipping_preferences_set, stripe_onboarding_complete, paypal_onboarding_complete,
    status, last_sign_in_at, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.user_id, NEW.username, NEW.avatar_url, NEW.location, NEW.country_code, NEW.region_id,
    NEW.rating, NEW.total_reviews, NEW.pause_selling,
    NEW.tiered_shipping_enabled, NEW.shipping_tier_1, NEW.shipping_tier_2, NEW.shipping_tier_3,
    NEW.bundle_shipping_mode, NEW.bundle_shipping_discount_percent,
    NEW.shipping_preferences_set, NEW.stripe_onboarding_complete, NEW.paypal_onboarding_complete,
    NEW.status, NEW.last_sign_in_at, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (user_id) DO UPDATE SET
    id = EXCLUDED.id,
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
    shipping_preferences_set = EXCLUDED.shipping_preferences_set,
    stripe_onboarding_complete = EXCLUDED.stripe_onboarding_complete,
    paypal_onboarding_complete = EXCLUDED.paypal_onboarding_complete,
    status = EXCLUDED.status,
    last_sign_in_at = EXCLUDED.last_sign_in_at,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_profiles_public() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profiles_public() TO service_role;

DROP TRIGGER IF EXISTS sync_profiles_public_on_profiles ON public.profiles;
CREATE TRIGGER sync_profiles_public_on_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profiles_public();

INSERT INTO public.profiles_public (
  id, user_id, username, avatar_url, location, country_code, region_id,
  rating, total_reviews, pause_selling,
  tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3,
  bundle_shipping_mode, bundle_shipping_discount_percent,
  shipping_preferences_set, stripe_onboarding_complete, paypal_onboarding_complete,
  status, last_sign_in_at, created_at, updated_at
)
SELECT
  id, user_id, username, avatar_url, location, country_code, region_id,
  rating, total_reviews, pause_selling,
  tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3,
  bundle_shipping_mode, bundle_shipping_discount_percent,
  shipping_preferences_set, stripe_onboarding_complete, paypal_onboarding_complete,
  status, last_sign_in_at, created_at, updated_at
FROM public.profiles
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
  shipping_preferences_set = EXCLUDED.shipping_preferences_set,
  stripe_onboarding_complete = EXCLUDED.stripe_onboarding_complete,
  paypal_onboarding_complete = EXCLUDED.paypal_onboarding_complete,
  status = EXCLUDED.status,
  last_sign_in_at = EXCLUDED.last_sign_in_at,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

REVOKE ALL ON FUNCTION public.get_profiles_public() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO service_role;