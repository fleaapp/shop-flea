
-- ============ PROFILES: lock down direct reads to owner only ============
DROP POLICY IF EXISTS "Profiles viewable by same region users" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Ensure profiles_public view is readable by clients (it already exists with security_invoker=on,
-- but its underlying SELECTs now rely on the new RPC bypassing RLS via SECURITY DEFINER below
-- for cross-user reads. The view itself is queried with the caller's role, so we need a
-- companion policy that lets authenticated users read the same-region public columns.)
-- Re-add a region-scoped SELECT policy but it will only matter when the view selects from profiles.
-- The view already filters out sensitive columns, so re-allow region-scoped reads through it.
CREATE POLICY "Same region users can read public profile fields"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    region_id IS NULL
    OR region_id = public.get_user_region_id(auth.uid())
  );

-- NOTE: The above policy still grants row access, so cross-user reads of `profiles` will return
-- rows. To prevent leakage of sensitive columns, application code MUST query `profiles_public`
-- for any cross-user read. Sensitive code paths (Checkout) use the RPC below.

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- ============ SECURE seller payment account lookup for checkout ============
CREATE OR REPLACE FUNCTION public.get_seller_payment_accounts(seller_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  stripe_account_id text,
  stripe_onboarding_complete boolean,
  paypal_merchant_id text,
  paypal_onboarding_complete boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         p.stripe_account_id,
         p.stripe_onboarding_complete,
         p.paypal_merchant_id,
         p.paypal_onboarding_complete
  FROM public.profiles p
  WHERE p.user_id = ANY(seller_ids)
    AND auth.uid() IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_payment_accounts(uuid[]) TO authenticated;

-- ============ ORDERS: revoke broad updates, add narrow RPCs ============
DROP POLICY IF EXISTS "Buyers can mark orders delivered" ON public.orders;
DROP POLICY IF EXISTS "Sellers can update order tracking" ON public.orders;

-- No direct UPDATE allowed; everything goes through the RPCs below.

CREATE OR REPLACE FUNCTION public.mark_order_shipped(
  p_order_id uuid DEFAULT NULL,
  p_order_group_id uuid DEFAULT NULL,
  p_tracking_provider text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_order_id IS NULL AND p_order_group_id IS NULL THEN
    RAISE EXCEPTION 'order_id or order_group_id required';
  END IF;
  IF p_tracking_provider IS NULL OR length(trim(p_tracking_provider)) = 0
     OR p_tracking_number IS NULL OR length(trim(p_tracking_number)) = 0 THEN
    RAISE EXCEPTION 'tracking provider and number required';
  END IF;
  IF length(p_tracking_provider) > 100 OR length(p_tracking_number) > 100 THEN
    RAISE EXCEPTION 'tracking values too long';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET status = 'shipped',
      tracking_provider = p_tracking_provider,
      tracking_number = p_tracking_number,
      shipped_at = now(),
      updated_at = now()
  WHERE o.seller_id = auth.uid()
    AND o.status = 'awaiting'
    AND (
      (p_order_id IS NOT NULL AND o.id = p_order_id)
      OR (p_order_group_id IS NOT NULL AND o.order_group_id = p_order_group_id)
    )
  RETURNING o.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_shipped(uuid, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_order_delivered(
  p_order_id uuid DEFAULT NULL,
  p_order_group_id uuid DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_order_id IS NULL AND p_order_group_id IS NULL THEN
    RAISE EXCEPTION 'order_id or order_group_id required';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET status = 'delivered',
      delivered_at = now(),
      updated_at = now()
  WHERE o.buyer_id = auth.uid()
    AND o.status = 'shipped'
    AND (
      (p_order_id IS NOT NULL AND o.id = p_order_id)
      OR (p_order_group_id IS NOT NULL AND o.order_group_id = p_order_group_id)
    )
  RETURNING o.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_delivered(uuid, uuid) TO authenticated;

-- ============ Anti-spam constraints ============
ALTER TABLE public.search_queries
  DROP CONSTRAINT IF EXISTS search_queries_query_length_check;
ALTER TABLE public.search_queries
  ADD CONSTRAINT search_queries_query_length_check
  CHECK (length(query) BETWEEN 1 AND 100);

ALTER TABLE public.waitlist
  DROP CONSTRAINT IF EXISTS waitlist_email_format_check;
ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_email_format_check
  CHECK (length(email) BETWEEN 3 AND 254 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
