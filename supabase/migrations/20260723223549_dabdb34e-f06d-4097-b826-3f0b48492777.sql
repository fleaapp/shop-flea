CREATE OR REPLACE FUNCTION public.mark_order_thread_read(_thread_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_related_order_ids uuid[] := ARRAY[]::uuid[];
  v_listing_ids uuid[] := ARRAY[]::uuid[];
  v_message_count integer := 0;
  v_notification_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT o.order_group_id
  INTO v_group_id
  FROM public.orders o
  WHERE o.id = _thread_id
     OR o.order_group_id = _thread_id
  ORDER BY o.created_at ASC
  LIMIT 1;

  SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[]),
         COALESCE(array_agg(o.listing_id), ARRAY[]::uuid[])
  INTO v_related_order_ids, v_listing_ids
  FROM public.orders o
  WHERE (o.id = _thread_id OR (v_group_id IS NOT NULL AND o.order_group_id = v_group_id))
    AND (o.buyer_id = v_user_id OR o.seller_id = v_user_id);

  IF COALESCE(array_length(v_related_order_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Not authorized for this order thread';
  END IF;

  WITH updated_messages AS (
    UPDATE public.order_messages om
    SET read = true
    WHERE om.order_id = ANY(v_related_order_ids)
      AND om.sender_id <> v_user_id
      AND COALESCE(om.read, false) = false
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_message_count FROM updated_messages;

  WITH updated_notifications AS (
    UPDATE public.notifications n
    SET is_read = true
    WHERE n.user_id = v_user_id
      AND COALESCE(n.is_read, false) = false
      AND n.type IN ('order_message_buyer', 'order_message_seller')
      AND (
        n.related_order_id = _thread_id
        OR (v_group_id IS NOT NULL AND n.related_order_id = v_group_id)
        OR n.related_order_id = ANY(v_related_order_ids)
        OR n.related_listing_id = ANY(v_listing_ids)
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_notification_count FROM updated_notifications;

  RETURN jsonb_build_object(
    'success', true,
    'messageCount', v_message_count,
    'notificationCount', v_notification_count,
    'orderIds', v_related_order_ids,
    'groupId', v_group_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_thread_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_thread_read(uuid) TO service_role;