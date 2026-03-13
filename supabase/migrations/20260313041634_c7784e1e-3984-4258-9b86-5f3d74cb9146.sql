-- Ensure public profile view remains security-invoker (respects table policies)
CREATE OR REPLACE VIEW public.profiles_public
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
  status,
  last_sign_in_at,
  created_at,
  updated_at
FROM public.profiles;

-- Cleanup function for deleted/blocked accounts
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

-- Backfill existing orphan/blocked user listings
UPDATE public.listings l
SET status = 'archived', updated_at = now()
WHERE l.status IS DISTINCT FROM 'archived'
  AND (
    NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = l.user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = l.user_id AND p.status = 'blocked'
    )
  );

-- Remove stale cart/favorite/discarded entries for archived listings
DELETE FROM public.cart_items c
USING public.listings l
WHERE c.listing_id = l.id
  AND l.status = 'archived';

DELETE FROM public.favorites f
USING public.listings l
WHERE f.listing_id = l.id
  AND l.status = 'archived';

DELETE FROM public.discarded_listings d
USING public.listings l
WHERE d.listing_id = l.id
  AND l.status = 'archived';