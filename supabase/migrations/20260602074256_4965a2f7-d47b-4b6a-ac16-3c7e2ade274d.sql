-- Add auth_provider column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS auth_provider text;

-- Backfill existing rows from auth.users metadata
UPDATE public.profiles p
SET auth_provider = COALESCE(
  (SELECT u.raw_app_meta_data->>'provider' FROM auth.users u WHERE u.id = p.user_id),
  'email'
)
WHERE p.auth_provider IS NULL;

-- Update handle_new_user trigger to populate auth_provider on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_username text;
  v_country_code text;
  v_region_id text;
  v_provider text;
BEGIN
  v_username := COALESCE(
    regexp_replace(
      left(NEW.raw_user_meta_data->>'username', 50),
      '[^a-zA-Z0-9_@-]',
      '',
      'g'
    ),
    '@user_' || LEFT(NEW.id::text, 8)
  );

  IF length(v_username) = 0 THEN
    v_username := '@user_' || LEFT(NEW.id::text, 8);
  END IF;

  v_country_code := NEW.raw_user_meta_data->>'country_code';
  v_region_id := NEW.raw_user_meta_data->>'region_id';
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  BEGIN
    INSERT INTO public.profiles (user_id, username, avatar_url, country_code, region_id, email, auth_provider)
    VALUES (
      NEW.id,
      v_username,
      NULL,
      v_country_code,
      v_region_id,
      NEW.email,
      v_provider
    );
  EXCEPTION
    WHEN unique_violation THEN
      v_username := '@user_' || LEFT(NEW.id::text, 8);
      INSERT INTO public.profiles (user_id, username, avatar_url, country_code, region_id, email, auth_provider)
      VALUES (
        NEW.id,
        v_username,
        NULL,
        v_country_code,
        v_region_id,
        NEW.email,
        v_provider
      );
  END;

  RETURN NEW;
END;
$function$;

-- Allow profiles_update_guard to permit auth_provider updates? No — it's set on insert only.
-- But the guard doesn't include auth_provider so updates by users would be allowed.
-- Add auth_provider to the protected list.
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
     OR NEW.region_id IS DISTINCT FROM OLD.region_id
     OR NEW.country_code IS DISTINCT FROM OLD.country_code
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at
     OR NEW.auth_provider IS DISTINCT FROM OLD.auth_provider
  THEN
    RAISE EXCEPTION 'Modification of protected profile fields is not allowed';
  END IF;

  RETURN NEW;
END;
$function$;