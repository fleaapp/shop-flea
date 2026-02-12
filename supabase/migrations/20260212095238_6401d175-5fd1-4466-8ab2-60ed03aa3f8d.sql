-- Drop the old trigger on listings
DROP TRIGGER IF EXISTS on_listing_sold ON public.listings;

-- Recreate the function to work on orders table instead, where buyer_id is directly available
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

  -- 1. Combined: users who have item in BOTH cart AND wishlist (exclude buyer and seller)
  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
  SELECT 
    ci.user_id,
    'cart_wishlist_item_sold',
    'Item Sold',
    v_listing_title,
    NEW.listing_id,
    v_listing_user_id
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
    v_listing_user_id
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
    v_listing_user_id
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

-- Create trigger on orders table instead (buyer_id is directly available as NEW.buyer_id)
CREATE TRIGGER on_order_notify_sold
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_users_on_listing_sold();
