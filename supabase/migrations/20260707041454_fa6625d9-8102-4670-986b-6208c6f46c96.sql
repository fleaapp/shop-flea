
-- Lock chat_messages UPDATE by non-service_role to only the `read` column
CREATE OR REPLACE FUNCTION public.chat_messages_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.thread_id IS DISTINCT FROM OLD.thread_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.sender_type IS DISTINCT FROM OLD.sender_type
     OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.attachment_url IS DISTINCT FROM OLD.attachment_url
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only the read column may be updated on chat_messages';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_update_guard_trg ON public.chat_messages;
CREATE TRIGGER chat_messages_update_guard_trg
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_messages_update_guard();

DROP POLICY IF EXISTS "Users can mark messages as read in their threads" ON public.chat_messages;
CREATE POLICY "Users can mark messages as read in their threads"
  ON public.chat_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id AND t.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id AND t.user_id = auth.uid()
  ));

-- Lock order_messages UPDATE by non-service_role to only the `read` column
CREATE OR REPLACE FUNCTION public.order_messages_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.attachment_url IS DISTINCT FROM OLD.attachment_url
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only the read column may be updated on order_messages';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_messages_update_guard_trg ON public.order_messages;
CREATE TRIGGER order_messages_update_guard_trg
BEFORE UPDATE ON public.order_messages
FOR EACH ROW EXECUTE FUNCTION public.order_messages_update_guard();

DROP POLICY IF EXISTS "Order participants can mark messages read" ON public.order_messages;
CREATE POLICY "Order participants can mark messages read"
ON public.order_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_messages.order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_messages.order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);
