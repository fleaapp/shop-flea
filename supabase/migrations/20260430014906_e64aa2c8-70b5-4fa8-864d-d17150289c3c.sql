CREATE OR REPLACE FUNCTION public.get_nav_badges(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_orders_count int := 0;
  seller_to_ship_count int := 0;
  unread_buyer_msgs int := 0;
  unread_seller_msgs int := 0;
  seller_unread_per_order jsonb := '{}'::jsonb;
  unread_support int := 0;
  activity_unread int := 0;
BEGIN
  -- Buyer orders awaiting + shipped (for cart badge)
  SELECT COUNT(*) INTO buyer_orders_count
  FROM orders
  WHERE buyer_id = _user_id AND status IN ('awaiting','shipped');

  -- Seller orders awaiting (for sales badge)
  SELECT COUNT(*) INTO seller_to_ship_count
  FROM orders
  WHERE seller_id = _user_id AND status = 'awaiting';

  -- Unread order messages where user is buyer
  SELECT COUNT(*) INTO unread_buyer_msgs
  FROM order_messages om
  JOIN orders o ON o.id = om.order_id
  WHERE o.buyer_id = _user_id
    AND om.sender_id <> _user_id
    AND om.read = false;

  -- Unread order messages where user is seller (totals + per-order map)
  SELECT COUNT(*) INTO unread_seller_msgs
  FROM order_messages om
  JOIN orders o ON o.id = om.order_id
  WHERE o.seller_id = _user_id
    AND om.sender_id <> _user_id
    AND om.read = false;

  SELECT COALESCE(jsonb_object_agg(order_id::text, cnt), '{}'::jsonb)
  INTO seller_unread_per_order
  FROM (
    SELECT om.order_id, COUNT(*) AS cnt
    FROM order_messages om
    JOIN orders o ON o.id = om.order_id
    WHERE o.seller_id = _user_id
      AND om.sender_id <> _user_id
      AND om.read = false
    GROUP BY om.order_id
  ) s;

  -- Unread support (chat_messages not from user in user's threads)
  SELECT COUNT(*) INTO unread_support
  FROM chat_messages cm
  JOIN chat_threads t ON t.id = cm.thread_id
  WHERE t.user_id = _user_id
    AND cm.sender_type <> 'user'
    AND cm.read = false;

  -- Activity notifications (unread)
  SELECT COUNT(*) INTO activity_unread
  FROM notifications
  WHERE user_id = _user_id AND COALESCE(is_read, false) = false;

  RETURN jsonb_build_object(
    'buyer_orders', buyer_orders_count,
    'seller_to_ship', seller_to_ship_count,
    'unread_buyer_msgs', unread_buyer_msgs,
    'unread_seller_msgs', unread_seller_msgs,
    'seller_unread_per_order', seller_unread_per_order,
    'unread_support', unread_support,
    'activity_unread', activity_unread
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nav_badges(uuid) TO authenticated;