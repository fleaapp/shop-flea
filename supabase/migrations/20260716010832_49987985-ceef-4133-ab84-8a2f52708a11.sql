
-- Extend profiles with negative balance tracking and device ids
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS negative_balance_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negative_balance_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_ids text[] NOT NULL DEFAULT '{}';

-- Allow service role to write these via profiles_update_guard
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
     OR NEW.negative_balance_cents IS DISTINCT FROM OLD.negative_balance_cents
     OR NEW.negative_balance_updated_at IS DISTINCT FROM OLD.negative_balance_updated_at
  THEN
    RAISE EXCEPTION 'Modification of protected profile fields is not allowed';
  END IF;

  RETURN NEW;
END;
$function$;

-- blocked_devices table
CREATE TABLE IF NOT EXISTS public.blocked_devices (
  device_id text PRIMARY KEY,
  reason text NOT NULL,
  associated_user_id uuid,
  amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.blocked_devices TO service_role;
-- No anon/authenticated grants: only edge functions (service_role) may read/write.

ALTER TABLE public.blocked_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.blocked_devices
  FOR ALL TO service_role USING (true) WITH CHECK (true);
