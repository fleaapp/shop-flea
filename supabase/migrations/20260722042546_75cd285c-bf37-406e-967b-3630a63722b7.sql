-- Dedupe item_sold notifications when multiple line items in one checkout
-- create multiple order rows for the same seller. Previously the seller
-- received one "Item Sold" alert per row (e.g. buying 3 items = 3 alerts).
-- Now we send a single alert for the first order in each order_group_id.
CREATE OR REPLACE FUNCTION public.notify_users_on_listing_sold()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_listing_title text;
  v_listing_user_id uuid;
  v_already_sent boolean := false;
BEGIN
  SELECT title, user_id INTO v_listing_title, v_listing_user_id
  FROM public.listings WHERE id = NEW.listing_id;

  IF v_listing_title IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only send ONE item_sold alert per checkout group. If another order in the
  -- same group already produced an item_sold notification for this seller,
  -- skip. Grouping by seller as well so different sellers in a shared cart
  -- (future-proofing) still each receive one.
  IF NEW.order_group_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.notifications n
      JOIN public.orders o
        ON o.id = n.related_order_id
       AND o.order_group_id = NEW.order_group_id
      WHERE n.type = 'item_sold'
        AND n.user_id = v_listing_user_id
    ) INTO v_already_sent;
  END IF;

  IF NOT v_already_sent THEN
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
  END IF;

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
$function$;