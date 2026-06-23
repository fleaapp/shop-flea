
-- 1. brands: drop open UPDATE policies; only service_role can write usage_count via SECURITY DEFINER RPC.
DROP POLICY IF EXISTS "Authenticated users can update brand usage_count" ON public.brands;
DROP POLICY IF EXISTS "Brands: only usage_count writable" ON public.brands;
REVOKE UPDATE ON public.brands FROM authenticated;
REVOKE UPDATE ON public.brands FROM anon;

CREATE OR REPLACE FUNCTION public.increment_brand_usage(_brand_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.brands SET usage_count = usage_count + 1 WHERE id = _brand_id;
$$;
REVOKE ALL ON FUNCTION public.increment_brand_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_brand_usage(uuid) TO authenticated;

-- 2. payment_events: drop client SELECT entirely (only service_role / webhook writes).
DROP POLICY IF EXISTS "Users can view their own payment events" ON public.payment_events;
REVOKE SELECT ON public.payment_events FROM authenticated;
REVOKE SELECT ON public.payment_events FROM anon;

-- 3. get_seller_payment_accounts: remove account IDs from the returned set.
-- Edge functions (stripe-connect-checkout, etc.) re-fetch the IDs server-side
-- via the service role and do not depend on this RPC for them.
DROP FUNCTION IF EXISTS public.get_seller_payment_accounts(uuid[]);
CREATE OR REPLACE FUNCTION public.get_seller_payment_accounts(seller_ids uuid[])
RETURNS TABLE(user_id uuid, stripe_onboarding_complete boolean, paypal_onboarding_complete boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         p.stripe_onboarding_complete,
         p.paypal_onboarding_complete
  FROM public.profiles p
  WHERE p.user_id = ANY(seller_ids)
    AND auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_seller_payment_accounts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_payment_accounts(uuid[]) TO authenticated;
