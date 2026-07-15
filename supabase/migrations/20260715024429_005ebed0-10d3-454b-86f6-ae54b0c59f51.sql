CREATE OR REPLACE FUNCTION public.get_nav_badges(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  buyer_orders_count int := 0;
  seller_to_ship_count int := 0;
  unread_buyer_msgs int := 0;
  unread_seller_msgs int := 0;
  seller_unread_per_order jsonb := '{}'::jsonb;
  unread_support int := 0;
  activity_unread int := 0;
BEGIN
  SELECT COUNT(*) INTO buyer_orders_count
  FROM orders
  WHERE buyer_id = _user_id AND status IN ('awaiting','shipped');

  SELECT COUNT(*) INTO seller_to_ship_count
  FROM orders
  WHERE seller_id = _user_id AND status = 'awaiting';

  SELECT COUNT(*) INTO unread_buyer_msgs
  FROM order_messages om
  JOIN orders o ON o.id = om.order_id
  WHERE o.buyer_id = _user_id
    AND o.status IN ('awaiting','shipped')
    AND om.sender_id <> _user_id
    AND om.read = false;

  SELECT COUNT(*) INTO unread_seller_msgs
  FROM order_messages om
  JOIN orders o ON o.id = om.order_id
  WHERE o.seller_id = _user_id
    AND o.status IN ('awaiting','shipped')
    AND om.sender_id <> _user_id
    AND om.read = false;

  SELECT COALESCE(jsonb_object_agg(order_id::text, cnt), '{}'::jsonb)
  INTO seller_unread_per_order
  FROM (
    SELECT om.order_id, COUNT(*) AS cnt
    FROM order_messages om
    JOIN orders o ON o.id = om.order_id
    WHERE o.seller_id = _user_id
      AND o.status IN ('awaiting','shipped')
      AND om.sender_id <> _user_id
      AND om.read = false
    GROUP BY om.order_id
  ) s;

  SELECT COUNT(*) INTO unread_support
  FROM chat_messages cm
  JOIN chat_threads t ON t.id = cm.thread_id
  WHERE t.user_id = _user_id
    AND cm.sender_type <> 'user'
    AND cm.read = false;

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
$function$;