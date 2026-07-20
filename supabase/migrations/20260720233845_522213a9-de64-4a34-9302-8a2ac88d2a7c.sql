CREATE INDEX IF NOT EXISTS listings_active_region_created_idx
  ON public.listings (region_id, created_at DESC)
  WHERE status = 'active';