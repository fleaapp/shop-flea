
-- Add order_number column with a sequential default
ALTER TABLE public.orders ADD COLUMN order_number TEXT;

-- Create a sequence for generating order numbers
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1001;

-- Create a function to auto-generate order numbers on insert
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'FL-' || LPAD(nextval('public.order_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();

-- Backfill existing orders with order numbers (grouped by order_group_id)
WITH numbered AS (
  SELECT id, order_group_id,
    'FL-' || LPAD((ROW_NUMBER() OVER (ORDER BY created_at) + 1000)::text, 6, '0') AS new_number
  FROM public.orders
  WHERE order_number IS NULL
)
UPDATE public.orders o
SET order_number = n.new_number
FROM numbered n
WHERE o.id = n.id;

-- For grouped orders, ensure all orders in the same group share the same order number
UPDATE public.orders o
SET order_number = sub.group_number
FROM (
  SELECT order_group_id, MIN(order_number) AS group_number
  FROM public.orders
  WHERE order_group_id IS NOT NULL
  GROUP BY order_group_id
) sub
WHERE o.order_group_id = sub.order_group_id
  AND o.order_group_id IS NOT NULL;

-- Update sequence to start after existing numbers
SELECT setval('public.order_number_seq', COALESCE(
  (SELECT MAX(REPLACE(order_number, 'FL-', '')::int) FROM public.orders WHERE order_number IS NOT NULL),
  1000
));
