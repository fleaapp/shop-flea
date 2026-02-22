
-- 1. Update notify_users_on_listing_sold to also create item_sold notification for seller
CREATE OR REPLACE FUNCTION public.notify_users_on_listing_sold()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_listing_title text;
  v_listing_user_id uuid;
BEGIN
  -- Get listing info
  SELECT title, user_id INTO v_listing_title, v_listing_user_id
  FROM public.listings WHERE id = NEW.listing_id;

  IF v_listing_title IS NULL THEN
    RETURN NEW;
  END IF;

  -- Notify the SELLER that their item was sold (related_user_id = buyer)
  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
  VALUES (
    v_listing_user_id,
    'item_sold',
    'Item Sold',
    v_listing_title,
    NEW.listing_id,
    NEW.buyer_id
  );

  -- 1. Combined: users who have item in BOTH cart AND wishlist (exclude buyer and seller)
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

  -- 2. Cart only: users who have item in cart but NOT wishlist
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

  -- 3. Wishlist only: users who have item in wishlist but NOT cart
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
$function$;

-- 2. Create trigger for new_review notifications
CREATE OR REPLACE FUNCTION public.notify_on_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Notify the reviewed user (related_user_id = reviewer)
  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
  SELECT
    NEW.reviewed_user_id,
    'new_review',
    'New Review',
    NULL,
    o.listing_id,
    NEW.reviewer_id
  FROM public.orders o
  WHERE o.id = NEW.order_id
  LIMIT 1;

  RETURN NEW;
END;
$function$;

-- Create the review notification trigger (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_review_created'
  ) THEN
    CREATE TRIGGER on_review_created
      AFTER INSERT ON public.reviews
      FOR EACH ROW
      EXECUTE FUNCTION public.notify_on_review();
  END IF;
END;
$$;

-- 3. Create trigger for order_shipped and order_delivered notifications  
CREATE OR REPLACE FUNCTION public.notify_on_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Shipped notification to buyer
  IF OLD.status = 'awaiting' AND NEW.status = 'shipped' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
    VALUES (
      NEW.buyer_id,
      'order_shipped',
      'Order Shipped',
      NULL,
      NEW.listing_id,
      NEW.seller_id
    );
  END IF;

  -- Delivered notification to seller
  IF OLD.status = 'shipped' AND NEW.status = 'delivered' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
    VALUES (
      NEW.seller_id,
      'order_delivered',
      'Order Delivered',
      NULL,
      NEW.listing_id,
      NEW.buyer_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_order_status_change'
  ) THEN
    CREATE TRIGGER on_order_status_change
      AFTER UPDATE OF status ON public.orders
      FOR EACH ROW
      EXECUTE FUNCTION public.notify_on_order_status_change();
  END IF;
END;
$$;

-- 4. Backfill old notifications missing related_user_id using order data
UPDATE public.notifications n
SET related_user_id = sub.buyer_id
FROM (
  SELECT DISTINCT ON (n2.id) n2.id as notification_id, o.buyer_id
  FROM public.notifications n2
  JOIN public.orders o ON o.listing_id = n2.related_listing_id
  WHERE n2.related_user_id IS NULL
    AND n2.related_listing_id IS NOT NULL
    AND n2.type IN ('cart_item_sold', 'wishlist_item_sold', 'cart_wishlist_item_sold', 'listing_sold', 'item_sold')
) sub
WHERE n.id = sub.notification_id;

-- Backfill listing_sold/item_sold notifications where related_user_id should be the buyer
UPDATE public.notifications n
SET related_user_id = sub.user_id
FROM (
  SELECT DISTINCT ON (n2.id) n2.id as notification_id, l.user_id
  FROM public.notifications n2
  JOIN public.listings l ON l.id = n2.related_listing_id
  WHERE n2.related_user_id IS NULL
    AND n2.related_listing_id IS NOT NULL
    AND n2.type NOT IN ('cart_item_sold', 'wishlist_item_sold', 'cart_wishlist_item_sold', 'listing_sold', 'item_sold',
                         'new_comment', 'comment_reply', 'shipping_reminder_3d', 'shipping_reminder_6d', 'mention')
) sub
WHERE n.id = sub.notification_id;
