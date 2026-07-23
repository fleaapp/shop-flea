REVOKE EXECUTE ON FUNCTION public.mark_order_thread_read(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_order_thread_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_order_thread_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_thread_read(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_support_thread_read(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_support_thread_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_support_thread_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_support_thread_read(uuid) TO service_role;