
CREATE OR REPLACE FUNCTION public.profiles_update_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
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
$function$;
