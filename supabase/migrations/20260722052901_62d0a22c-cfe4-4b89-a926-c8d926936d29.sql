
-- Badge count + activity feed
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON public.notifications (user_id, is_read, created_at DESC);

-- Nav badges + dashboards
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status
  ON public.orders (buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status
  ON public.orders (seller_id, status);

-- Unread message counts per order
CREATE INDEX IF NOT EXISTS idx_order_messages_order_unread
  ON public.order_messages (order_id)
  WHERE read = false;

-- Sold-notification fanout
CREATE INDEX IF NOT EXISTS idx_cart_items_listing
  ON public.cart_items (listing_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing
  ON public.favorites (listing_id);

-- Home feed candidate scan
CREATE INDEX IF NOT EXISTS idx_listings_status_region_created
  ON public.listings (status, region_id, created_at DESC);

-- Support unread
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_unread
  ON public.chat_messages (thread_id)
  WHERE read = false;
