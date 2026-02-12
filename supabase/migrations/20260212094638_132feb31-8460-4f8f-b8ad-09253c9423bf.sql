-- Drop the old duplicate trigger that creates notifications with wrong format
DROP TRIGGER IF EXISTS notify_wishlist_cart_on_order_created ON public.orders;

-- Drop the old function too since it's no longer needed
DROP FUNCTION IF EXISTS public.notify_wishlist_cart_on_sold();
