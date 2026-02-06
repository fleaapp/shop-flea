-- Add tiered shipping preferences to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tiered_shipping_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS shipping_tier_1 numeric DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS shipping_tier_2 numeric DEFAULT 7.00,
ADD COLUMN IF NOT EXISTS shipping_tier_3 numeric DEFAULT 9.00,
ADD COLUMN IF NOT EXISTS shipping_preferences_set boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.tiered_shipping_enabled IS 'Whether seller uses tiered shipping (combined rates) or individual per-listing shipping';
COMMENT ON COLUMN public.profiles.shipping_tier_1 IS 'Base shipping cost for 1 item';
COMMENT ON COLUMN public.profiles.shipping_tier_2 IS 'Shipping cost for 2-3 items combined';
COMMENT ON COLUMN public.profiles.shipping_tier_3 IS 'Shipping cost for 4+ items combined';
COMMENT ON COLUMN public.profiles.shipping_preferences_set IS 'Whether seller has completed initial shipping setup';