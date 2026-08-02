CREATE OR REPLACE FUNCTION public.increment_coupon_redemption(_coupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.coupons
  SET redemption_count = redemption_count + 1,
      updated_at = now()
  WHERE id = _coupon_id;
$$;

REVOKE ALL ON FUNCTION public.increment_coupon_redemption(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_coupon_redemption(uuid) TO service_role;