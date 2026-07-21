DROP INDEX IF EXISTS public.idx_notifications_unique_order_event;

CREATE UNIQUE INDEX idx_notifications_unique_order_event
  ON public.notifications (user_id, type, related_order_id)
  WHERE related_order_id IS NOT NULL
    AND type NOT IN (
      'order_message_buyer',
      'order_message_seller',
      'order_shipped',
      'order_delivered'
    );