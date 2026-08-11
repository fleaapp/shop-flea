-- Drop duplicate indexes that waste space and slow writes
DROP INDEX IF EXISTS public.idx_orders_buyer_status;
DROP INDEX IF EXISTS public.idx_orders_group_id;
DROP INDEX IF EXISTS public.idx_profiles_region;

-- Composite index for admin error-log filtering
CREATE INDEX IF NOT EXISTS error_logs_created_at_source_severity_idx
  ON public.error_logs (created_at DESC, source, severity);
