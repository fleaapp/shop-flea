ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by_seller boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seller_cancel_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.profiles_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.bypass_profile_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.total_reviews IS DISTINCT FROM OLD.total_reviews
     OR NEW.report_strike_count IS DISTINCT FROM OLD.report_strike_count
     OR NEW.tracking_flagged IS DISTINCT FROM OLD.tracking_flagged
     OR NEW.wrong_tracking_count IS DISTINCT FROM OLD.wrong_tracking_count
     OR NEW.seller_cancel_count IS DISTINCT FROM OLD.seller_cancel_count
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

CREATE OR REPLACE FUNCTION public.seller_cancel_order_begin(p_order_id uuid, p_reason text)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'order_id required'; END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'A cancellation reason is required.'; END IF;

  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.seller_id = v_uid
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  IF v_order.refunded_at IS NOT NULL OR v_order.status = 'refunded' THEN
    RAISE EXCEPTION 'This item has already been refunded.';
  END IF;
  IF v_order.shipped_at IS NOT NULL OR v_order.status <> 'awaiting' THEN
    RAISE EXCEPTION 'Only items that have not been shipped yet can be cancelled.';
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles
  SET seller_cancel_count = COALESCE(seller_cancel_count, 0) + 1,
      updated_at = now()
  WHERE user_id = v_uid;
  PERFORM set_config('app.bypass_profile_guard', 'off', true);

  RETURN QUERY
  UPDATE public.orders o
  SET cancelled_by_seller = true,
      refund_reason = LEFT(btrim(p_reason), 500),
      updated_at = now()
  WHERE o.id = v_order.id
  RETURNING o.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seller_relist_cancelled_listing(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.seller_id = v_uid
    AND o.cancelled_by_seller = true;

  IF v_order.id IS NULL THEN
    RETURN false;
  END IF;
  IF v_order.refunded_at IS NULL AND v_order.status <> 'refunded' THEN
    RETURN false;
  END IF;
  IF v_order.listing_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.bypass_report_guard', 'on', true);
  UPDATE public.listings
  SET status = 'active',
      updated_at = now()
  WHERE id = v_order.listing_id
    AND user_id = v_uid
    AND status IN ('sold', 'refunded');
  PERFORM set_config('app.bypass_report_guard', 'off', true);

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.seller_cancel_order_begin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seller_relist_cancelled_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_cancel_order_begin(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seller_relist_cancelled_listing(uuid) TO authenticated, service_role;