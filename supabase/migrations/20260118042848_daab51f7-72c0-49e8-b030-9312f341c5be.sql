-- Add order_group_id column to group items bought together from the same seller
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_group_id uuid DEFAULT NULL;

-- Create index for efficient lookups by order group
CREATE INDEX IF NOT EXISTS idx_orders_order_group_id ON public.orders(order_group_id);