
CREATE OR REPLACE FUNCTION public.notify_users_on_listing_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id uuid;
  v_listing_title text;
BEGIN
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN
    
    SELECT buyer_id INTO v_buyer_id
    FROM public.orders
    WHERE listing_id = NEW.id
    ORDER BY created_at DESC
    LIMIT 1;

    v_listing_title := NEW.title;

    -- 1. Combined: users who have item in BOTH cart AND wishlist
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
    SELECT 
      ci.user_id,
      'cart_wishlist_item_sold',
      'Item Sold',
      v_listing_title,
      NEW.id,
      NEW.user_id
    FROM public.cart_items ci
    INNER JOIN public.favorites f ON f.user_id = ci.user_id AND f.listing_id = ci.listing_id
    WHERE ci.listing_id = NEW.id
      AND ci.user_id != NEW.user_id
      AND (v_buyer_id IS NULL OR ci.user_id != v_buyer_id);

    -- 2. Cart only: users who have item in cart but NOT wishlist
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
    SELECT 
      ci.user_id,
      'cart_item_sold',
      'Item Sold',
      v_listing_title,
      NEW.id,
      NEW.user_id
    FROM public.cart_items ci
    WHERE ci.listing_id = NEW.id
      AND ci.user_id != NEW.user_id
      AND (v_buyer_id IS NULL OR ci.user_id != v_buyer_id)
      AND ci.user_id NOT IN (
        SELECT f.user_id FROM public.favorites f WHERE f.listing_id = NEW.id
      );

    -- 3. Wishlist only: users who have item in wishlist but NOT cart
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
    SELECT 
      f.user_id,
      'wishlist_item_sold',
      'Item Sold',
      v_listing_title,
      NEW.id,
      NEW.user_id
    FROM public.favorites f
    WHERE f.listing_id = NEW.id
      AND f.user_id != NEW.user_id
      AND (v_buyer_id IS NULL OR f.user_id != v_buyer_id)
      AND f.user_id NOT IN (
        SELECT ci.user_id FROM public.cart_items ci WHERE ci.listing_id = NEW.id
      );
  END IF;
  
  RETURN NEW;
END;
$$;
