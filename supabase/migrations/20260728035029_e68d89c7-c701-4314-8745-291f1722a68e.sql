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
      shipped_at = COALESCE(o.shipped_at, now()),
      delivered_at = COALESCE(o.delivered_at, now()),
      admin_marked_delivered = CASE WHEN p_source = 'admin' THEN true ELSE o.admin_marked_delivered END,
      dispute_window_ends_at = COALESCE(o.dispute_window_ends_at, now() + interval '2 days'),
      updated_at = now()
  WHERE o.status IN ('awaiting', 'shipped')
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