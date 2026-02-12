
CREATE OR REPLACE FUNCTION public.notify_users_on_listing_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id uuid;
BEGIN
  -- Only trigger when status changes to 'sold'
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN
    
    -- Find the buyer from the most recent order for this listing
    SELECT buyer_id INTO v_buyer_id
    FROM public.orders
    WHERE listing_id = NEW.id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Notify users who have this item in their cart (exclude seller and buyer)
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
    SELECT 
      cart_items.user_id,
      'cart_item_sold',
      'Item Sold',
      'An item in your cart was sold.',
      NEW.id,
      NEW.user_id
    FROM public.cart_items
    WHERE cart_items.listing_id = NEW.id
      AND cart_items.user_id != NEW.user_id
      AND (v_buyer_id IS NULL OR cart_items.user_id != v_buyer_id);
    
    -- Notify users who have this item in their favorites/wishlist (exclude seller, buyer, and already-notified cart users)
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
    SELECT 
      favorites.user_id,
      'wishlist_item_sold',
      'Item Sold',
      'An item in your wishlist was sold.',
      NEW.id,
      NEW.user_id
    FROM public.favorites
    WHERE favorites.listing_id = NEW.id
      AND favorites.user_id != NEW.user_id
      AND (v_buyer_id IS NULL OR favorites.user_id != v_buyer_id)
      AND favorites.user_id NOT IN (
        SELECT cart_items.user_id FROM public.cart_items WHERE cart_items.listing_id = NEW.id
      );
  END IF;
  
  RETURN NEW;
END;
$$;
