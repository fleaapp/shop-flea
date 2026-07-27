CREATE OR REPLACE FUNCTION public.request_refund(
  p_order_id uuid DEFAULT NULL,
  p_order_group_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_order_id IS NULL AND p_order_group_id IS NULL THEN
    RAISE EXCEPTION 'order_id or order_group_id required';
  END IF;

  -- Fetch and lock the order(s) we intend to update to enforce the 48-hour window.
  SELECT *
  INTO v_order
  FROM public.orders o
  WHERE (o.buyer_id = v_uid OR o.seller_id = v_uid)
    AND o.status = 'delivered'
    AND o.refunded_at IS NULL
    AND (o.refund_requested_at IS NULL OR o.refund_declined_at IS NOT NULL)
    AND (
      (p_order_id IS NOT NULL AND o.id = p_order_id)
      OR (p_order_group_id IS NOT NULL AND o.order_group_id = p_order_group_id)
    )
  ORDER BY o.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Refund request not allowed: order must be delivered and within 48 hours of delivery.';
  END IF;

  IF v_order.delivered_at IS NULL OR v_order.delivered_at < (now() - interval '48 hours') THEN
    RAISE EXCEPTION 'Refund window has closed. Refunds can only be requested within 48 hours of delivery.';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET refund_requested_at = now(),
      refund_requested_by = v_uid,
      refund_request_reason = LEFT(COALESCE(p_reason, ''), 500),
      refund_request_deadline_at = now() + interval '72 hours',
      refund_declined_at = NULL,
      refund_declined_reason = NULL,
      updated_at = now()
  WHERE o.id = v_order.id
  RETURNING o.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_refund(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_refund_request(uuid, uuid, text, text) TO authenticated;