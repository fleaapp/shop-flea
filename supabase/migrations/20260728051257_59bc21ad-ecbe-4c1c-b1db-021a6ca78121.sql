
-- 1) Add admin-gate flag for buyer-confirmed untracked deliveries.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pending_admin_delivery_review boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_pending_admin_delivery
  ON public.orders (pending_admin_delivery_review)
  WHERE pending_admin_delivery_review = true;

-- 2) Update mark_order_delivered: still move to 'delivered', but flag
--    untracked buyer-confirmed rows for admin review and defer the
--    48h dispute window until approval.
CREATE OR REPLACE FUNCTION public.mark_order_delivered(
  p_order_id uuid DEFAULT NULL::uuid,
  p_order_group_id uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'buyer'::text
) RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      -- Flag untracked buyer-confirmed deliveries for admin review.
      pending_admin_delivery_review = CASE
        WHEN p_source = 'buyer'
             AND (o.tracking_number IS NULL OR length(trim(o.tracking_number)) = 0)
          THEN true
        ELSE o.pending_admin_delivery_review
      END,
      -- Only start the 48h dispute window if not flagged for admin review.
      dispute_window_ends_at = CASE
        WHEN p_source = 'buyer'
             AND (o.tracking_number IS NULL OR length(trim(o.tracking_number)) = 0)
          THEN o.dispute_window_ends_at  -- leave NULL until admin approves
        ELSE COALESCE(o.dispute_window_ends_at, now() + interval '2 days')
      END,
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
$function$;

-- 3) Auto-complete should skip orders held for admin review.
CREATE OR REPLACE FUNCTION public.auto_complete_delivered_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
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
$function$;

-- 4) Admin approves an untracked delivery: clears flag, starts 48h window.
CREATE OR REPLACE FUNCTION public.admin_approve_untracked_delivery(p_order_id uuid)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET pending_admin_delivery_review = false,
      admin_marked_delivered = true,
      dispute_window_ends_at = COALESCE(o.dispute_window_ends_at, now() + interval '2 days'),
      updated_at = now()
  WHERE o.id = p_order_id
    AND o.pending_admin_delivery_review = true
  RETURNING o.*;
END;
$function$;

-- 5) Admin rejects an untracked delivery: reverts to 'awaiting', notifies
--    both parties.
CREATE OR REPLACE FUNCTION public.admin_reject_untracked_delivery(p_order_id uuid, p_reason text DEFAULT NULL::text)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET status = 'awaiting',
      delivered_at = NULL,
      dispute_window_ends_at = NULL,
      pending_admin_delivery_review = false,
      admin_marked_delivered = false,
      updated_at = now()
  WHERE o.id = p_order_id
  RETURNING o.*;

  INSERT INTO public.notifications (user_id, type, title, message, related_order_id, related_listing_id)
  VALUES
    (v_order.buyer_id, 'delivery_review_rejected', 'Delivery review rejected',
     'Our team reviewed your delivery confirmation and reverted the order to awaiting shipment. ' || COALESCE(p_reason, ''),
     v_order.id, v_order.listing_id),
    (v_order.seller_id, 'delivery_review_rejected', 'Delivery review rejected',
     'A buyer''s delivery confirmation was reverted. Please ship the order.',
     v_order.id, v_order.listing_id);
END;
$function$;

-- 6) Security: revoke anon EXECUTE on functions that require an
--    authenticated caller. Keep authenticated + service_role.
REVOKE EXECUTE ON FUNCTION public.mark_order_delivered(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_order_shipped(uuid, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_order(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_refund(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_support_thread_read(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_order_thread_read(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_tracking(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_tracking(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_dismiss_refund_dispute(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_untracked_delivery(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_untracked_delivery(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_push_vault_key(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_record_rate_limit(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_mention_notifications(text[], uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_brand_usage(uuid) FROM anon;
