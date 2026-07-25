
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_requested_by uuid,
  ADD COLUMN IF NOT EXISTS refund_request_reason text,
  ADD COLUMN IF NOT EXISTS refund_request_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_declined_reason text;

CREATE INDEX IF NOT EXISTS idx_orders_refund_pending
  ON public.orders (refund_request_deadline_at)
  WHERE refund_requested_at IS NOT NULL AND refunded_at IS NULL AND refund_declined_at IS NULL;

-- Request a refund (buyer requests, or seller offers)
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_order_id IS NULL AND p_order_group_id IS NULL THEN
    RAISE EXCEPTION 'order_id or order_group_id required';
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
  WHERE (o.buyer_id = v_uid OR o.seller_id = v_uid)
    AND o.status IN ('shipped', 'delivered')
    AND o.refunded_at IS NULL
    AND (o.refund_requested_at IS NULL OR o.refund_declined_at IS NOT NULL)
    AND (
      (p_order_id IS NOT NULL AND o.id = p_order_id)
      OR (p_order_group_id IS NOT NULL AND o.order_group_id = p_order_group_id)
    )
  RETURNING o.*;
END;
$$;

-- Respond to a refund request (the OTHER party approves or declines)
-- Approval simply marks the pending state cleared and returns rows;
-- the caller then invokes stripe-connect-refund edge function to actually refund.
CREATE OR REPLACE FUNCTION public.respond_to_refund_request(
  p_order_id uuid DEFAULT NULL,
  p_order_group_id uuid DEFAULT NULL,
  p_decision text DEFAULT 'decline',
  p_reason text DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_decision NOT IN ('approve','decline') THEN
    RAISE EXCEPTION 'decision must be approve or decline';
  END IF;

  IF p_decision = 'decline' THEN
    RETURN QUERY
    UPDATE public.orders o
    SET refund_declined_at = now(),
        refund_declined_reason = LEFT(COALESCE(p_reason, ''), 500),
        updated_at = now()
    WHERE (o.buyer_id = v_uid OR o.seller_id = v_uid)
      AND o.refund_requested_at IS NOT NULL
      AND o.refund_requested_by IS DISTINCT FROM v_uid
      AND o.refunded_at IS NULL
      AND o.refund_declined_at IS NULL
      AND (
        (p_order_id IS NOT NULL AND o.id = p_order_id)
        OR (p_order_group_id IS NOT NULL AND o.order_group_id = p_order_group_id)
      )
    RETURNING o.*;
  ELSE
    -- Approve: verify the responder is the OTHER party and there's a pending request.
    -- Actual refund is executed by edge function; here we just return matching rows.
    RETURN QUERY
    SELECT o.*
    FROM public.orders o
    WHERE (o.buyer_id = v_uid OR o.seller_id = v_uid)
      AND o.refund_requested_at IS NOT NULL
      AND o.refund_requested_by IS DISTINCT FROM v_uid
      AND o.refunded_at IS NULL
      AND o.refund_declined_at IS NULL
      AND (
        (p_order_id IS NOT NULL AND o.id = p_order_id)
        OR (p_order_group_id IS NOT NULL AND o.order_group_id = p_order_group_id)
      );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_refund(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_refund_request(uuid, uuid, text, text) TO authenticated;
