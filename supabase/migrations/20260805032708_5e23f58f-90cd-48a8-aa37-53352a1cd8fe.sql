-- 1) Coupons: remove client-readable exposure of codes / redemption limits.
DROP POLICY IF EXISTS "Authenticated can read active coupons" ON public.coupons;
REVOKE ALL ON public.coupons FROM anon, authenticated;
GRANT ALL ON public.coupons TO service_role;

-- 2) Orders: make the fail-closed posture explicit at the privilege level.
REVOKE UPDATE, DELETE ON public.orders FROM anon, authenticated;
GRANT ALL ON public.orders TO service_role;