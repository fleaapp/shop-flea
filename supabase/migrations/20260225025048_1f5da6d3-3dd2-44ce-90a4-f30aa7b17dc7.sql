
-- Create order_messages table for post-purchase buyer-seller chat
CREATE TABLE public.order_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_group_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Buyers and sellers involved in the order can view messages
CREATE POLICY "Order participants can view messages"
ON public.order_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.order_group_id = order_messages.order_group_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
  OR
  -- Fallback for legacy orders without order_group_id
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_messages.order_group_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- Participants can send messages (only if within 10 days of delivery or not yet delivered)
CREATE POLICY "Order participants can send messages"
ON public.order_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE (o.order_group_id = order_messages.order_group_id OR o.id = order_messages.order_group_id)
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
      AND (
        o.delivered_at IS NULL
        OR o.delivered_at > now() - interval '10 days'
      )
    )
  )
);

-- Participants can mark messages as read
CREATE POLICY "Order participants can mark messages read"
ON public.order_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE (o.order_group_id = order_messages.order_group_id OR o.id = order_messages.order_group_id)
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- Create storage bucket for order message attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('order-attachments', 'order-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for order attachments
CREATE POLICY "Authenticated users can upload order attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'order-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Order attachments are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'order-attachments');

-- Enable realtime for order messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
