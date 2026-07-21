
-- Drop duplicate notification triggers (keep canonical trg_ versions)
DROP TRIGGER IF EXISTS on_comment_created ON public.listing_comments;
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
DROP TRIGGER IF EXISTS on_review_created ON public.reviews;

-- Clean up existing doubled notification rows (last 30 days) for these event types.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, type,
             COALESCE(related_order_id::text,''),
             COALESCE(related_listing_id::text,''),
             COALESCE(related_user_id::text,''),
             created_at
           ORDER BY id
         ) AS rn
  FROM public.notifications
  WHERE created_at > now() - interval '30 days'
    AND type IN (
      'new_comment','comment_reply','mention',
      'order_shipped','order_delivered',
      'new_review'
    )
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id AND r.rn > 1;

-- Safety-net unique index for order status change events (shipped/delivered)
-- Uses created_at so double-trigger rows collide but real status transitions still succeed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_order_status_event
  ON public.notifications (user_id, type, related_order_id, created_at)
  WHERE type IN ('order_shipped','order_delivered')
    AND related_order_id IS NOT NULL;
