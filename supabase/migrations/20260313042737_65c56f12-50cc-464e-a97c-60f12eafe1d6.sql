-- Ensure public profile lookup is not constrained by profiles RLS (used for cross-region public metadata lookups)
CREATE OR REPLACE VIEW public.profiles_public AS
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
  status,
  last_sign_in_at,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Keep cleanup behavior tied to profile deletion/blocking
CREATE OR REPLACE FUNCTION public.cleanup_user_listings_on_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE' AND NEW.status = 'blocked' AND OLD.status IS DISTINCT FROM NEW.status) THEN

    UPDATE public.listings
    SET status = 'archived', updated_at = now()
    WHERE user_id = v_user_id
      AND status IS DISTINCT FROM 'archived';

    DELETE FROM public.cart_items
    WHERE listing_id IN (
      SELECT id FROM public.listings WHERE user_id = v_user_id
    );

    DELETE FROM public.favorites
    WHERE listing_id IN (
      SELECT id FROM public.listings WHERE user_id = v_user_id
    );

    DELETE FROM public.discarded_listings
    WHERE listing_id IN (
      SELECT id FROM public.listings WHERE user_id = v_user_id
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_profile_status_cleanup ON public.profiles;
CREATE TRIGGER on_profile_status_cleanup
AFTER UPDATE OF status ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_user_listings_on_profile_change();

DROP TRIGGER IF EXISTS on_profile_delete_cleanup ON public.profiles;
CREATE TRIGGER on_profile_delete_cleanup
AFTER DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_user_listings_on_profile_change();