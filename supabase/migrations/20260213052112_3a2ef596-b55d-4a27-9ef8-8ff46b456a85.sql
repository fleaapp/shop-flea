
-- Add Stripe Connect columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_account_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false;

-- Drop and recreate profiles_public view with new column
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public AS
SELECT 
  id,
  user_id,
  username,
  avatar_url,
  location,
  country_code,
  region_id,
  status,
  pause_selling,
  rating,
  total_reviews,
  tiered_shipping_enabled,
  shipping_tier_1,
  shipping_tier_2,
  shipping_tier_3,
  shipping_preferences_set,
  stripe_onboarding_complete,
  created_at,
  updated_at
FROM public.profiles;
