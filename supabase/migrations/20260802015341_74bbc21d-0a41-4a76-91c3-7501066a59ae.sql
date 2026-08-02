CREATE OR REPLACE FUNCTION public.request_refund(p_order_id uuid DEFAULT NULL::uuid, p_order_group_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS SETOF orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_lost_parcel boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_order_id IS NULL AND p_order_group_id IS NULL THEN
    RAISE EXCEPTION 'order_id or order_group_id required';
  END IF;

  -- Eligible either: delivered (48h window) OR shipped/awaiting for 10+ days
  -- with no delivery recorded (lost parcel).
  SELECT *
  INTO v_order
  FROM public.orders o
  WHERE (o.buyer_id = v_uid OR o.seller_id = v_uid)
    AND o.status IN ('delivered', 'shipped', 'awaiting')
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
    RAISE EXCEPTION 'Refund request not allowed for this order.';
  END IF;

  v_lost_parcel := v_order.delivered_at IS NULL
    AND COALESCE(v_order.shipped_at, v_order.created_at) < (now() - interval '10 days');

  IF NOT v_lost_parcel THEN
    IF v_order.status <> 'delivered' THEN
      RAISE EXCEPTION 'Refund request not allowed: order must be delivered, or in transit for more than 10 days.';
    END IF;
    IF v_order.delivered_at IS NULL OR v_order.delivered_at < (now() - interval '48 hours') THEN
      RAISE EXCEPTION 'Refund window has closed. Refunds can only be requested within 48 hours of delivery.';
    END IF;
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
$function$;

REVOKE ALL ON FUNCTION public.request_refund(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_refund(uuid, uuid, text) TO authenticated, service_role;