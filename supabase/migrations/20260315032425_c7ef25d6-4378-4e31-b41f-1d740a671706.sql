
-- Add related_order_id and related_thread_id columns to notifications
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS related_order_id uuid,
  ADD COLUMN IF NOT EXISTS related_thread_id uuid;

-- Create trigger function for order message notifications
CREATE OR REPLACE FUNCTION public.notify_on_order_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order record;
  v_sender_username text;
  v_listing_title text;
  v_recipient_id uuid;
  v_notif_type text;
  v_notif_message text;
BEGIN
  -- Get order details
  SELECT buyer_id, seller_id, listing_id INTO v_order
  FROM public.orders WHERE id = NEW.order_id;

  IF v_order IS NULL THEN RETURN NEW; END IF;

  -- Get sender username
  SELECT username INTO v_sender_username
  FROM public.profiles WHERE user_id = NEW.sender_id;

  -- Get listing title
  SELECT title INTO v_listing_title
  FROM public.listings WHERE id = v_order.listing_id;

  -- Determine recipient and notification type
  IF NEW.sender_id = v_order.seller_id THEN
    -- Seller sent message → notify buyer
    v_recipient_id := v_order.buyer_id;
    v_notif_type := 'order_message_seller';
    v_notif_message := '💬 New message from @' || COALESCE(v_sender_username, 'seller') || ' about your order! Tap to view.';
  ELSIF NEW.sender_id = v_order.buyer_id THEN
    -- Buyer sent message → notify seller
    v_recipient_id := v_order.seller_id;
    v_notif_type := 'order_message_buyer';
    v_notif_message := '📩 New message from your buyer @' || COALESCE(v_sender_username, 'buyer') || '! Tap to view.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id, related_order_id)
  VALUES (
    v_recipient_id,
    v_notif_type,
    'New Message',
    v_notif_message,
    v_order.listing_id,
    NEW.sender_id,
    NEW.order_id
  );

  RETURN NEW;
END;
$$;

-- Create trigger on order_messages
DROP TRIGGER IF EXISTS on_order_message_notify ON public.order_messages;
CREATE TRIGGER on_order_message_notify
  AFTER INSERT ON public.order_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_order_message();

-- Create trigger function for support message notifications
CREATE OR REPLACE FUNCTION public.notify_on_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_thread_user_id uuid;
BEGIN
  -- Only notify when support (non-user) sends a message
  IF NEW.sender_type = 'user' THEN RETURN NEW; END IF;

  -- Get the thread owner
  SELECT user_id INTO v_thread_user_id
  FROM public.chat_threads WHERE id = NEW.thread_id;

  IF v_thread_user_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_thread_id)
  VALUES (
    v_thread_user_id,
    'support_message',
    'Support Message',
    '🛎️ New message from Flea support. Tap to view.',
    NEW.thread_id
  );

  RETURN NEW;
END;
$$;

-- Create trigger on chat_messages
DROP TRIGGER IF EXISTS on_support_message_notify ON public.chat_messages;
CREATE TRIGGER on_support_message_notify
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_support_message();

-- Update the order status change trigger to include item names in messages
CREATE OR REPLACE FUNCTION public.notify_on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_listing_title text;
  v_other_titles text[];
  v_combined_title text;
BEGIN
  -- Get listing title for this order
  SELECT title INTO v_listing_title
  FROM public.listings WHERE id = NEW.listing_id;

  -- Shipped notification to buyer
  IF OLD.status = 'awaiting' AND NEW.status = 'shipped' THEN
    -- Check if there are other orders in the same group
    IF NEW.order_group_id IS NOT NULL THEN
      SELECT array_agg(l.title) INTO v_other_titles
      FROM public.orders o
      JOIN public.listings l ON l.id = o.listing_id
      WHERE o.order_group_id = NEW.order_group_id
        AND o.id != NEW.id
        AND o.status = 'shipped';
      
      IF v_other_titles IS NOT NULL AND array_length(v_other_titles, 1) > 0 THEN
        v_combined_title := COALESCE(v_listing_title, 'your item') || ' & ' || v_other_titles[1];
      ELSE
        v_combined_title := COALESCE(v_listing_title, 'your item');
      END IF;
    ELSE
      v_combined_title := COALESCE(v_listing_title, 'your item');
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id, related_order_id)
    VALUES (
      NEW.buyer_id,
      'order_shipped',
      'Order Shipped',
      '📦 Your order ' || v_combined_title || ' is on the way! Tap for details.',
      NEW.listing_id,
      NEW.seller_id,
      NEW.id
    );
  END IF;

  -- Delivered notification to seller
  IF OLD.status = 'shipped' AND NEW.status = 'delivered' THEN
    -- Check if there are other orders in the same group
    IF NEW.order_group_id IS NOT NULL THEN
      SELECT array_agg(l.title) INTO v_other_titles
      FROM public.orders o
      JOIN public.listings l ON l.id = o.listing_id
      WHERE o.order_group_id = NEW.order_group_id
        AND o.id != NEW.id
        AND o.status = 'delivered';
      
      IF v_other_titles IS NOT NULL AND array_length(v_other_titles, 1) > 0 THEN
        v_combined_title := COALESCE(v_listing_title, 'your item') || ' & ' || v_other_titles[1];
      ELSE
        v_combined_title := COALESCE(v_listing_title, 'your item');
      END IF;
    ELSE
      v_combined_title := COALESCE(v_listing_title, 'your item');
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id, related_order_id)
    VALUES (
      NEW.buyer_id,
      'order_delivered',
      'Order Delivered',
      'Delivered! Your order ' || v_combined_title || ' is home safe 🏠 Tap for details.',
      NEW.listing_id,
      NEW.seller_id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Update the item_sold notification trigger message
CREATE OR REPLACE FUNCTION public.notify_users_on_listing_sold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_listing_title text;
  v_listing_user_id uuid;
BEGIN
  SELECT title, user_id INTO v_listing_title, v_listing_user_id
  FROM public.listings WHERE id = NEW.listing_id;

  IF v_listing_title IS NULL THEN
    RETURN NEW;
  END IF;

  -- Notify the SELLER with updated copy
  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id, related_order_id)
  VALUES (
    v_listing_user_id,
    'item_sold',
    'Item Sold',
    v_listing_title,
    NEW.listing_id,
    NEW.buyer_id,
    NEW.id
  );

  -- Combined: users who have item in BOTH cart AND wishlist
  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
  SELECT 
    ci.user_id,
    'cart_wishlist_item_sold',
    'Item Sold',
    v_listing_title,
    NEW.listing_id,
    NEW.buyer_id
  FROM public.cart_items ci
  INNER JOIN public.favorites f ON f.user_id = ci.user_id AND f.listing_id = ci.listing_id
  WHERE ci.listing_id = NEW.listing_id
    AND ci.user_id != v_listing_user_id
    AND ci.user_id != NEW.buyer_id;

  -- Cart only
  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
  SELECT 
    ci.user_id,
    'cart_item_sold',
    'Item Sold',
    v_listing_title,
    NEW.listing_id,
    NEW.buyer_id
  FROM public.cart_items ci
  WHERE ci.listing_id = NEW.listing_id
    AND ci.user_id != v_listing_user_id
    AND ci.user_id != NEW.buyer_id
    AND ci.user_id NOT IN (
      SELECT f.user_id FROM public.favorites f WHERE f.listing_id = NEW.listing_id
    );

  -- Wishlist only
  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
  SELECT 
    f.user_id,
    'wishlist_item_sold',
    'Item Sold',
    v_listing_title,
    NEW.listing_id,
    NEW.buyer_id
  FROM public.favorites f
  WHERE f.listing_id = NEW.listing_id
    AND f.user_id != v_listing_user_id
    AND f.user_id != NEW.buyer_id
    AND f.user_id NOT IN (
      SELECT ci.user_id FROM public.cart_items ci WHERE ci.listing_id = NEW.listing_id
    );

  RETURN NEW;
END;
$$;
