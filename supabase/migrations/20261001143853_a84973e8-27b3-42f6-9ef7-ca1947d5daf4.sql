REVOKE ALL ON FUNCTION public.seller_is_available(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_is_available(uuid) TO service_role;