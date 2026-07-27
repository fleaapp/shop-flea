CREATE OR REPLACE FUNCTION public.admin_dismiss_refund_dispute(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins may dismiss refund disputes';
  END IF;

  SELECT order_group_id INTO v_group FROM public.orders WHERE id = p_order_id;

  UPDATE public.orders
     SET refund_requested_at = NULL,
         refund_requested_by = NULL,
         refund_request_reason = NULL,
         refund_request_deadline_at = NULL,
         refund_declined_at = NULL,
         refund_declined_reason = NULL,
         updated_at = now()
   WHERE (id = p_order_id)
      OR (v_group IS NOT NULL AND order_group_id = v_group)
      AND refunded_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dismiss_refund_dispute(uuid) TO authenticated;