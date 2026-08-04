CREATE OR REPLACE FUNCTION public.auto_complete_delivered_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Safety net: a delivered order that never got a protection-window end date
  -- (e.g. an untracked delivery left in admin review) must not hold seller
  -- funds forever. After 7 days from delivery we stamp the window so the
  -- normal completion path can pick it up.
  UPDATE public.orders
  SET dispute_window_ends_at = delivered_at + interval '2 days',
      pending_admin_delivery_review = false,
      updated_at = now()
  WHERE status = 'delivered'
    AND dispute_window_ends_at IS NULL
    AND delivered_at IS NOT NULL
    AND delivered_at <= now() - interval '7 days'
    AND refunded_at IS NULL
    AND completed_at IS NULL;

  WITH updated AS (
    UPDATE public.orders
    SET status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE status = 'delivered'
      AND COALESCE(pending_admin_delivery_review, false) = false
      AND dispute_window_ends_at IS NOT NULL
      AND dispute_window_ends_at <= now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;