ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['awaiting'::text, 'shipped'::text, 'delivered'::text, 'refunded'::text]));

UPDATE public.orders
SET status = 'refunded',
    updated_at = now()
WHERE refunded_at IS NOT NULL
  AND status IS DISTINCT FROM 'refunded';

CREATE OR REPLACE FUNCTION public.enforce_refunded_order_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.refunded_at IS NOT NULL THEN
    NEW.status := 'refunded';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_refunded_order_status_trigger ON public.orders;
CREATE TRIGGER enforce_refunded_order_status_trigger
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_refunded_order_status();

NOTIFY pgrst, 'reload schema';