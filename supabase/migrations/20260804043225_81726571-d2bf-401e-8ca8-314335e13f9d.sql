-- 1) Exact-match realtime topic authorization
DROP POLICY IF EXISTS "Authenticated users can subscribe to own user topics" ON realtime.messages;

CREATE POLICY "Authenticated users can subscribe to own user topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'notifications-' || (auth.uid())::text
  OR realtime.topic() = 'nav-badges-' || (auth.uid())::text
  OR realtime.topic() = 'cart-offers-' || (auth.uid())::text
);

-- 2) coupon_redemptions: read-only for clients, writes only via service role
REVOKE INSERT, UPDATE, DELETE ON public.coupon_redemptions FROM authenticated;
REVOKE ALL ON public.coupon_redemptions FROM anon;
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;