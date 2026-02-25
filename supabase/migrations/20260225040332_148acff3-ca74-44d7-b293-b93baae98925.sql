
-- Rename column from order_group_id to order_id
ALTER TABLE public.order_messages RENAME COLUMN order_group_id TO order_id;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Order participants can view messages" ON public.order_messages;
DROP POLICY IF EXISTS "Order participants can send messages" ON public.order_messages;
DROP POLICY IF EXISTS "Order participants can mark messages read" ON public.order_messages;

-- Recreate RLS policies using order_id referencing individual orders
CREATE POLICY "Order participants can view messages"
ON public.order_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_messages.order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

CREATE POLICY "Order participants can send messages"
ON public.order_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_messages.order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    AND (o.delivered_at IS NULL OR o.delivered_at > (now() - '10 days'::interval))
  )
);

CREATE POLICY "Order participants can mark messages read"
ON public.order_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_messages.order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);
