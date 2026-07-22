-- ============================================================
-- 1. Revoke anon access to functions that should not be public
-- ============================================================

-- Internal trigger function; should never be called directly.
REVOKE EXECUTE ON FUNCTION public.set_waitlist_region() FROM anon;

-- Exposes per-user region information; authenticated callers only.
REVOKE EXECUTE ON FUNCTION public.get_user_region_id(uuid) FROM anon;

-- Role checks are internal; authenticated callers only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;

-- User block status is internal/sensitive; authenticated callers only.
REVOKE EXECUTE ON FUNCTION public.is_user_blocked(uuid) FROM anon;

-- ============================================================
-- 2. Additional targeted indexes for common lookup paths
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_waitlist_email
  ON public.waitlist (email);

CREATE INDEX IF NOT EXISTS idx_waitlist_region_created
  ON public.waitlist (region_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_queries_created
  ON public.search_queries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_region_status_created
  ON public.listings (region_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_messages_read_sender
  ON public.order_messages (order_id, sender_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
  ON public.chat_messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_status_last_sign_in
  ON public.profiles (status, last_sign_in_at DESC);