ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS checkout_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_reference_listing_unique
ON public.orders (checkout_reference, listing_id)
WHERE checkout_reference IS NOT NULL;

DROP TRIGGER IF EXISTS orders_generate_order_number_before_insert ON public.orders;
CREATE TRIGGER orders_generate_order_number_before_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_number();

DROP TRIGGER IF EXISTS orders_mark_listing_as_sold_after_insert ON public.orders;
CREATE TRIGGER orders_mark_listing_as_sold_after_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.mark_listing_as_sold();

DROP TRIGGER IF EXISTS orders_notify_users_on_listing_sold_after_insert ON public.orders;
CREATE TRIGGER orders_notify_users_on_listing_sold_after_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_users_on_listing_sold();