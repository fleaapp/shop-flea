-- profiles_public is a read-only snapshot maintained by triggers.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles_public FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles_public FROM authenticated;

-- payment_events: backend/service-role only. No client role should hold any grant.
REVOKE ALL ON public.payment_events FROM anon;
REVOKE ALL ON public.payment_events FROM authenticated;
GRANT ALL ON public.payment_events TO service_role;

-- coupon_redemptions: written only by checkout (service role); owners may read via RLS.
REVOKE ALL ON public.coupon_redemptions FROM anon;
REVOKE ALL ON public.coupon_redemptions FROM authenticated;
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;

-- saved_searches and rate_limits stay service-role only (edge functions / definer fns).
GRANT ALL ON public.saved_searches TO service_role;
GRANT ALL ON public.rate_limits TO service_role;