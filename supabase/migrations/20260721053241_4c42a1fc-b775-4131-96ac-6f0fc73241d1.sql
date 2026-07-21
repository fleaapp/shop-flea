DO $$
DECLARE
  trigger_record record;
BEGIN
  -- Keep sold-item notifications centralized in one canonical order trigger.
  FOR trigger_record IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'orders'
      AND p.proname = 'notify_users_on_listing_sold'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.orders', trigger_record.tgname);
  END LOOP;

  CREATE TRIGGER trg_notify_users_on_listing_sold
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_users_on_listing_sold();

  -- Keep push sending centralized in one canonical notifications trigger.
  FOR trigger_record IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'notifications'
      AND p.proname = 'trigger_push_notification'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.notifications', trigger_record.tgname);
  END LOOP;

  CREATE TRIGGER trg_push_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_push_notification();
END $$;

-- Remove recent duplicate notifications, keeping the first row created.
DELETE FROM public.notifications n
USING public.notifications keeper
WHERE n.id > keeper.id
  AND n.created_at > now() - interval '30 days'
  AND n.user_id = keeper.user_id
  AND n.type = keeper.type
  AND COALESCE(n.related_order_id::text, '') = COALESCE(keeper.related_order_id::text, '')
  AND COALESCE(n.related_listing_id::text, '') = COALESCE(keeper.related_listing_id::text, '')
  AND COALESCE(n.related_thread_id::text, '') = COALESCE(keeper.related_thread_id::text, '')
  AND COALESCE(n.related_user_id::text, '') = COALESCE(keeper.related_user_id::text, '')
  AND COALESCE(n.title, '') = COALESCE(keeper.title, '')
  AND COALESCE(n.message, '') = COALESCE(keeper.message, '');

-- Prevent duplicated order-specific alerts (sold, shipped, delivered, refunded, reviews linked to orders).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_order_event
  ON public.notifications (user_id, type, related_order_id)
  WHERE related_order_id IS NOT NULL;

-- Prevent duplicated listing-specific sold/cart/wishlist alerts when there is no order id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_listing_sold_event
  ON public.notifications (user_id, type, related_listing_id)
  WHERE related_order_id IS NULL
    AND related_listing_id IS NOT NULL
    AND type IN ('item_sold', 'cart_item_sold', 'wishlist_item_sold', 'cart_wishlist_item_sold');