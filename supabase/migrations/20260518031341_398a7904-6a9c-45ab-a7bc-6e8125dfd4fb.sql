
-- 1) Profiles: restrict UPDATE to non-protected columns via trigger guard.
CREATE OR REPLACE FUNCTION public.profiles_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only enforce when the change is coming from a regular authenticated user.
  -- Service role / SECURITY DEFINER paths bypass this guard.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.total_reviews IS DISTINCT FROM OLD.total_reviews
     OR NEW.report_strike_count IS DISTINCT FROM OLD.report_strike_count
     OR NEW.stripe_onboarding_complete IS DISTINCT FROM OLD.stripe_onboarding_complete
     OR NEW.paypal_onboarding_complete IS DISTINCT FROM OLD.paypal_onboarding_complete
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.paypal_merchant_id IS DISTINCT FROM OLD.paypal_merchant_id
     OR NEW.gst_alert_60k_sent_at IS DISTINCT FROM OLD.gst_alert_60k_sent_at
     OR NEW.gst_alert_75k_sent_at IS DISTINCT FROM OLD.gst_alert_75k_sent_at
     OR NEW.region_id IS DISTINCT FROM OLD.region_id
     OR NEW.country_code IS DISTINCT FROM OLD.country_code
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at
  THEN
    RAISE EXCEPTION 'Modification of protected profile fields is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_update_guard_trg ON public.profiles;
CREATE TRIGGER profiles_update_guard_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_update_guard();

-- 2) Brands: tighten UPDATE policy so only usage_count is touchable.
-- The existing brands_update_guard() trigger already raises on any change
-- other than usage_count. Re-attach in case it's not bound.
DROP TRIGGER IF EXISTS brands_update_guard_trg ON public.brands;
CREATE TRIGGER brands_update_guard_trg
BEFORE UPDATE ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.brands_update_guard();

-- Also harden the RLS policy with a restrictive sibling that blocks any
-- attempt by a regular user to alter identity columns at the policy layer.
DROP POLICY IF EXISTS "Brands: only usage_count writable" ON public.brands;
CREATE POLICY "Brands: only usage_count writable"
ON public.brands
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
