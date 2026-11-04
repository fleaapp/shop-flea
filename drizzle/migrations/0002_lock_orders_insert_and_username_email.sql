DROP POLICY IF EXISTS "Buyers can create valid orders" ON public.orders;
REVOKE INSERT ON public.orders FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO service_role;