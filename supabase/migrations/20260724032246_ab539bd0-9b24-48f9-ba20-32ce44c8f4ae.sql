-- Add a transaction-local bypass flag that the rating trigger sets so the
-- profiles_update_guard allows the automated rating/total_reviews update.

CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_avg_rating numeric;
  v_total_reviews integer;
BEGIN
  -- Signal to profiles_update_guard that this transaction is the trusted
  -- rating aggregation path. Scoped to the current transaction via `is_local`.
  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.reviewed_user_id;
  ELSE
    v_user_id := NEW.reviewed_user_id;
  END IF;

  SELECT
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
    COUNT(*)
  INTO v_avg_rating, v_total_reviews
  FROM public.reviews
  WHERE reviewed_user_id = v_user_id;

  UPDATE public.profiles
  SET
    rating = v_avg_rating,
    total_reviews = v_total_reviews,
    updated_at = now()
  WHERE user_id = v_user_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Trusted server paths bypass the guard.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Trigger-local bypass set by update_user_rating(). Any non-'on' value
  -- (including NULL when unset) falls through to the normal checks.
  IF current_setting('app.bypass_profile_guard', true) = 'on' THEN
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
     OR (NEW.region_id IS DISTINCT FROM OLD.region_id AND OLD.region_id IS NOT NULL)
     OR (NEW.country_code IS DISTINCT FROM OLD.country_code AND OLD.country_code IS NOT NULL)
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.auth_provider IS DISTINCT FROM OLD.auth_provider
     OR NEW.negative_balance_cents IS DISTINCT FROM OLD.negative_balance_cents
     OR NEW.negative_balance_updated_at IS DISTINCT FROM OLD.negative_balance_updated_at
  THEN
    RAISE EXCEPTION 'Modification of protected profile fields is not allowed';
  END IF;

  RETURN NEW;
END;
$$;
