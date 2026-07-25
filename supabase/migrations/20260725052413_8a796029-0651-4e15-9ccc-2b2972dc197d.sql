
-- 1. Orders columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_approved_by uuid,
  ADD COLUMN IF NOT EXISTS tracking_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_rejection_reason text,
  ADD COLUMN IF NOT EXISTS admin_marked_delivered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_window_ends_at timestamptz;

-- Expand status check to include 'completed'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['awaiting'::text, 'shipped'::text, 'delivered'::text, 'completed'::text, 'refunded'::text]));

-- 2. Profiles columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wrong_tracking_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tracking_flagged boolean NOT NULL DEFAULT false;

-- 3. Update listings guard to permit new statuses (delivered/completed transitions)
-- Existing guard already permits shipped→delivered. Add completed to allowed list-like
-- transitions on orders via new function below (no listings change needed).

-- 4. Extend mark_order_delivered to record source (buyer or admin)
CREATE OR REPLACE FUNCTION public.mark_order_delivered(
  p_order_id uuid DEFAULT NULL,
  p_order_group_id uuid DEFAULT NULL,
  p_source text DEFAULT 'buyer'
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_order_id IS NULL AND p_order_group_id IS NULL THEN
    RAISE EXCEPTION 'order_id or order_group_id required';
  END IF;

  IF p_source = 'admin' THEN
    SELECT public.has_role(auth.uid(), 'admin') INTO v_is_admin;
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Admin only';
    END IF;
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET status = 'delivered',
      delivered_at = COALESCE(o.delivered_at, now()),
      admin_marked_delivered = CASE WHEN p_source = 'admin' THEN true ELSE o.admin_marked_delivered END,
      dispute_window_ends_at = COALESCE(o.dispute_window_ends_at, now() + interval '2 days'),
      updated_at = now()
  WHERE o.status = 'shipped'
    AND (
      v_is_admin
      OR o.buyer_id = auth.uid()
    )
    AND (
      (p_order_id IS NOT NULL AND o.id = p_order_id)
      OR (p_order_group_id IS NOT NULL AND o.order_group_id = p_order_group_id)
    )
  RETURNING o.*;
END;
$$;

-- 5. Buyer/admin function: complete an order (releases funds)
CREATE OR REPLACE FUNCTION public.complete_order(
  p_order_id uuid DEFAULT NULL,
  p_order_group_id uuid DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_order_id IS NULL AND p_order_group_id IS NULL THEN
    RAISE EXCEPTION 'order_id or order_group_id required';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET status = 'completed',
      completed_at = now(),
      delivered_at = COALESCE(o.delivered_at, now()),
      updated_at = now()
  WHERE o.status IN ('delivered', 'shipped')
    AND (o.buyer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    AND (
      (p_order_id IS NOT NULL AND o.id = p_order_id)
      OR (p_order_group_id IS NOT NULL AND o.order_group_id = p_order_group_id)
    )
  RETURNING o.*;
END;
$$;

-- 6. Admin: approve tracking
CREATE OR REPLACE FUNCTION public.admin_approve_tracking(p_order_id uuid)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET tracking_approved_at = now(),
      tracking_approved_by = auth.uid(),
      tracking_rejected_at = NULL,
      tracking_rejection_reason = NULL,
      updated_at = now()
  WHERE o.id = p_order_id
    AND o.status = 'shipped'
  RETURNING o.*;
END;
$$;

-- 7. Admin: reject tracking (increments seller counter, flags at 3)
CREATE OR REPLACE FUNCTION public.admin_reject_tracking(p_order_id uuid, p_reason text)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seller_id uuid;
  v_new_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT seller_id INTO v_seller_id FROM public.orders WHERE id = p_order_id;
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Bypass profile guard for trusted admin update
  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles
  SET wrong_tracking_count = wrong_tracking_count + 1,
      tracking_flagged = CASE WHEN wrong_tracking_count + 1 >= 3 THEN true ELSE tracking_flagged END,
      updated_at = now()
  WHERE user_id = v_seller_id
  RETURNING wrong_tracking_count INTO v_new_count;

  -- Revert order back to awaiting so seller must re-submit tracking
  RETURN QUERY
  UPDATE public.orders o
  SET status = 'awaiting',
      tracking_provider = NULL,
      tracking_number = NULL,
      shipped_at = NULL,
      tracking_rejected_at = now(),
      tracking_rejection_reason = p_reason,
      tracking_approved_at = NULL,
      tracking_approved_by = NULL,
      updated_at = now()
  WHERE o.id = p_order_id
  RETURNING o.*;

  -- Notify seller
  INSERT INTO public.notifications (user_id, type, title, message, related_order_id)
  VALUES (
    v_seller_id,
    'tracking_rejected',
    'Tracking rejected',
    CASE WHEN v_new_count >= 3
      THEN 'Your tracking was rejected: ' || COALESCE(p_reason, 'invalid') || '. Your account is flagged for review.'
      ELSE 'Your tracking was rejected: ' || COALESCE(p_reason, 'invalid') || '. Please re-submit a valid tracking number.'
    END,
    p_order_id
  );
END;
$$;

-- 8. Auto-complete cron: any delivered order whose dispute window elapsed
CREATE OR REPLACE FUNCTION public.auto_complete_delivered_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.orders
    SET status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE status = 'delivered'
      AND dispute_window_ends_at IS NOT NULL
      AND dispute_window_ends_at <= now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- 9. 10-day fallback: shipped + approved + 10 days → delivered (opens dispute window)
CREATE OR REPLACE FUNCTION public.auto_deliver_shipped_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.orders
    SET status = 'delivered',
        delivered_at = now(),
        dispute_window_ends_at = now() + interval '2 days',
        updated_at = now()
    WHERE status = 'shipped'
      AND tracking_approved_at IS NOT NULL
      AND shipped_at IS NOT NULL
      AND shipped_at <= now() - interval '10 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- Schedule via pg_cron: run every hour
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('flea-auto-order-progress') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'flea-auto-order-progress'
    );
    PERFORM cron.schedule(
      'flea-auto-order-progress',
      '15 * * * *',
      $cron$
      SELECT public.auto_deliver_shipped_orders();
      SELECT public.auto_complete_delivered_orders();
      $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'cron scheduling skipped: %', SQLERRM;
END $$;
