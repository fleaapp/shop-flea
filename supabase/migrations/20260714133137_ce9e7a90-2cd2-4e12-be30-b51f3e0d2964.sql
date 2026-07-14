-- Coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'waive_buyer_fee',
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  expires_at timestamptz,
  max_redemptions integer,
  redemption_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read active coupons"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (active = true);

CREATE TRIGGER coupons_set_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Redemptions
CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_group_id uuid,
  checkout_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, checkout_reference)
);
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own redemptions"
  ON public.coupon_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Seed FREEFLEA (waives Secure Checkout Fee for buyers)
INSERT INTO public.coupons (code, type, active) VALUES ('FREEFLEA', 'waive_buyer_fee', true);

-- Onboarding resume step
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_step text;

-- Allow profiles_update_guard to permit stripe_onboarding_step self-updates (recreate guard)
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