
DROP POLICY IF EXISTS "Users can mark messages as read in their threads" ON public.chat_messages;
CREATE POLICY "Users can mark messages as read in their threads"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (
  sender_id IS DISTINCT FROM auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id AND t.user_id = auth.uid()
  )
)
WITH CHECK (
  sender_id IS DISTINCT FROM auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Order participants can mark messages read" ON public.order_messages;
CREATE POLICY "Order participants can mark messages read"
ON public.order_messages
FOR UPDATE
TO authenticated
USING (
  sender_id IS DISTINCT FROM auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_messages.order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
)
WITH CHECK (
  sender_id IS DISTINCT FROM auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_messages.order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);
