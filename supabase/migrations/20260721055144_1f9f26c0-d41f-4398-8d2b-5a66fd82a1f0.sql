
-- 1. Drop duplicate triggers (keeping the canonical trg_ versions)
DROP TRIGGER IF EXISTS on_support_message_notify ON public.chat_messages;
DROP TRIGGER IF EXISTS on_order_message_notify ON public.order_messages;

-- 2. Clean up existing duplicate notifications (last 30 days).
-- Duplicates from double-firing triggers share identical created_at within the same tx.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, type,
             COALESCE(related_order_id::text,''),
             COALESCE(related_thread_id::text,''),
             COALESCE(related_listing_id::text,''),
             COALESCE(related_user_id::text,''),
             created_at
           ORDER BY id
         ) AS rn
  FROM public.notifications
  WHERE created_at > now() - interval '30 days'
    AND type IN (
      'order_message_buyer','order_message_seller',
      'support_message','new_comment','comment_reply','mention','new_review'
    )
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id AND r.rn > 1;

-- 3. Safety-net unique indexes. created_at is IMMUTABLE-safe in a unique index;
-- duplicates from double triggers share the exact same timestamp within one tx,
-- so they collide, but distinct real events at different times still succeed.

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_order_message
  ON public.notifications (user_id, type, related_order_id, created_at)
  WHERE type IN ('order_message_buyer','order_message_seller')
    AND related_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_support_message
  ON public.notifications (user_id, type, related_thread_id, created_at)
  WHERE type = 'support_message' AND related_thread_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_comment_event
  ON public.notifications (user_id, type, related_listing_id, related_user_id, created_at)
  WHERE type IN ('new_comment','comment_reply','mention')
    AND related_listing_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_review_event
  ON public.notifications (user_id, type, related_user_id, related_listing_id)
  WHERE type = 'new_review' AND related_user_id IS NOT NULL;
