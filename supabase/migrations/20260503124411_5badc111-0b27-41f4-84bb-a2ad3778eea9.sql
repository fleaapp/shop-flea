
-- Listings: active feed by region, newest first
CREATE INDEX IF NOT EXISTS idx_listings_status_region_created
  ON public.listings (status, region_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_user_status
  ON public.listings (user_id, status);

-- Orders: buyer + seller lookups
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status_created
  ON public.orders (buyer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_seller_status_created
  ON public.orders (seller_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_listing_id
  ON public.orders (listing_id);

CREATE INDEX IF NOT EXISTS idx_orders_group_id
  ON public.orders (order_group_id);

-- Notifications: per-user, newest first; unread filter
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read)
  WHERE is_read = false;

-- Favorites & cart: prevent duplicates + speed up reads
CREATE UNIQUE INDEX IF NOT EXISTS uq_favorites_user_listing
  ON public.favorites (user_id, listing_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_user_listing
  ON public.cart_items (user_id, listing_id);

-- Chat & order messages: thread/order lookups, newest first
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
  ON public.chat_messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_messages_order_created
  ON public.order_messages (order_id, created_at DESC);

-- Comments per listing
CREATE INDEX IF NOT EXISTS idx_listing_comments_listing_created
  ON public.listing_comments (listing_id, created_at DESC);

-- Reviews lookups
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_user
  ON public.reviews (reviewed_user_id, created_at DESC);

-- Profiles by region (used by region-scoped RLS)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_region
  ON public.profiles (region_id);
