-- 1. Order columns for the return-before-refund flow
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_path text,
  ADD COLUMN IF NOT EXISTS return_required_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_tracking_provider text,
  ADD COLUMN IF NOT EXISTS return_tracking_number text,
  ADD COLUMN IF NOT EXISTS return_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_seller_at_fault boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_escalated_at timestamptz;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_refund_path_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_refund_path_check
  CHECK (refund_path IS NULL OR refund_path IN ('return', 'direct'));

CREATE INDEX IF NOT EXISTS orders_return_required_idx
  ON public.orders (return_required_at)
  WHERE return_required_at IS NOT NULL AND return_delivered_at IS NULL;

-- 2. Shipment kind so return parcels are tracked separately
ALTER TABLE public.tracking_shipments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'outbound';
ALTER TABLE public.tracking_shipments
  DROP CONSTRAINT IF EXISTS tracking_shipments_kind_check;
ALTER TABLE public.tracking_shipments
  ADD CONSTRAINT tracking_shipments_kind_check CHECK (kind IN ('outbound', 'return'));

-- 3. request_refund: 14 day seller window + refund path
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
  v_reason text := LEFT(COALESCE(p_reason, ''), 500);
  v_path text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_order_id IS NULL AND p_order_group_id IS NULL THEN
    RAISE EXCEPTION 'order_id or order_group_id required';
  END IF;

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

  -- Lost or never-arrived parcels have nothing to send back: direct refund.
  -- Everything else follows the return-before-refund path.
  IF v_lost_parcel OR v_reason ILIKE '%never arrived%' OR v_reason ILIKE '%not arrive%' OR v_reason ILIKE '%lost%' THEN
    v_path := 'direct';
  ELSE
    v_path := 'return';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET refund_requested_at = now(),
      refund_requested_by = v_uid,
      refund_request_reason = v_reason,
      refund_request_deadline_at = now() + interval '14 days',
      refund_path = v_path,
      refund_declined_at = NULL,
      refund_declined_reason = NULL,
      refund_escalated_at = NULL,
      return_required_at = NULL,
      return_deadline_at = NULL,
      return_closed_at = NULL,
      updated_at = now()
  WHERE o.id = v_order.id
  RETURNING o.*;
END;
$function$;

-- 4. respond_to_refund_request: approving a return-path request opens the return leg
CREATE OR REPLACE FUNCTION public.respond_to_refund_request(p_order_id uuid DEFAULT NULL::uuid, p_order_group_id uuid DEFAULT NULL::uuid, p_decision text DEFAULT 'decline'::text, p_reason text DEFAULT NULL::text)
 RETURNS SETOF orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Approve. Return-path requests open a 5 day return window instead of
    -- refunding straight away; direct-path requests are refunded by the
    -- edge function as before.
    RETURN QUERY
    UPDATE public.orders o
    SET return_required_at = CASE WHEN COALESCE(o.refund_path, 'return') = 'return' THEN now() ELSE o.return_required_at END,
        return_deadline_at = CASE WHEN COALESCE(o.refund_path, 'return') = 'return' THEN now() + interval '5 days' ELSE o.return_deadline_at END,
        refund_escalated_at = NULL,
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
  END IF;
END;
$function$;

-- 5. Buyer submits return tracking
CREATE OR REPLACE FUNCTION public.submit_return_tracking(p_order_id uuid, p_provider text, p_number text)
 RETURNS SETOF orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF COALESCE(TRIM(p_provider), '') = '' THEN RAISE EXCEPTION 'Carrier required'; END IF;
  IF COALESCE(TRIM(p_number), '') = '' THEN RAISE EXCEPTION 'Tracking number required'; END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET return_tracking_provider = TRIM(p_provider),
      return_tracking_number = UPPER(REGEXP_REPLACE(TRIM(p_number), '[\s-]+', '', 'g')),
      return_posted_at = COALESCE(o.return_posted_at, now()),
      updated_at = now()
  WHERE o.id = p_order_id
    AND o.buyer_id = v_uid
    AND o.return_required_at IS NOT NULL
    AND o.return_delivered_at IS NULL
    AND o.return_closed_at IS NULL
    AND o.refunded_at IS NULL
  RETURNING o.*;
END;
$function$;

-- 6. Admin: require a return as the dispute outcome
CREATE OR REPLACE FUNCTION public.admin_require_return(p_order_id uuid, p_seller_at_fault boolean DEFAULT false)
 RETURNS SETOF orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET refund_path = 'return',
      return_required_at = now(),
      return_deadline_at = now() + interval '5 days',
      return_closed_at = NULL,
      refund_seller_at_fault = COALESCE(p_seller_at_fault, false),
      refund_declined_at = NULL,
      refund_declined_reason = NULL,
      refund_escalated_at = NULL,
      updated_at = now()
  WHERE o.id = p_order_id
    AND o.refunded_at IS NULL
  RETURNING o.*;
END;
$function$;

-- 7. Escalate unanswered refund requests to the admin dispute queue
CREATE OR REPLACE FUNCTION public.escalate_lapsed_refund_requests()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.orders o
    SET refund_escalated_at = now(),
        updated_at = now()
    WHERE o.refund_requested_at IS NOT NULL
      AND o.refund_declined_at IS NULL
      AND o.refund_escalated_at IS NULL
      AND o.refunded_at IS NULL
      AND o.return_required_at IS NULL
      AND o.refund_request_deadline_at IS NOT NULL
      AND o.refund_request_deadline_at <= now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$function$;

-- 8. Close returns the buyer never posted
CREATE OR REPLACE FUNCTION public.close_stale_returns()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.orders o
    SET return_closed_at = now(),
        refund_requested_at = NULL,
        refund_request_deadline_at = NULL,
        return_required_at = NULL,
        return_deadline_at = NULL,
        refund_escalated_at = NULL,
        updated_at = now()
    WHERE o.return_required_at IS NOT NULL
      AND o.return_delivered_at IS NULL
      AND o.return_closed_at IS NULL
      AND o.return_tracking_number IS NULL
      AND o.refunded_at IS NULL
      AND o.return_deadline_at IS NOT NULL
      AND o.return_deadline_at <= now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_return_tracking(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_return_tracking(uuid, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_require_return(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_require_return(uuid, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.escalate_lapsed_refund_requests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_lapsed_refund_requests() TO service_role;
REVOKE ALL ON FUNCTION public.close_stale_returns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_stale_returns() TO service_role;