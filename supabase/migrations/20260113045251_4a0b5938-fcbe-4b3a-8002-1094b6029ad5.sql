-- Create a function to notify users when a listing is marked as sold
CREATE OR REPLACE FUNCTION public.notify_users_on_listing_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when status changes to 'sold'
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN
    
    -- Notify users who have this item in their cart
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
      AND cart_items.user_id != NEW.user_id; -- Don't notify the seller
    
    -- Notify users who have this item in their favorites/wishlist
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
      AND favorites.user_id != NEW.user_id -- Don't notify the seller
      AND favorites.user_id NOT IN (
        -- Don't double-notify if already in cart
        SELECT cart_items.user_id FROM public.cart_items WHERE cart_items.listing_id = NEW.id
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on listings table
DROP TRIGGER IF EXISTS on_listing_sold ON public.listings;
CREATE TRIGGER on_listing_sold
  AFTER UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_users_on_listing_sold();

-- Also need to allow INSERT on notifications table for the trigger to work
-- The trigger runs as SECURITY DEFINER so it has elevated privileges
-- But we should also add a policy for the system to insert notifications

-- Add INSERT policy for notifications (for system/trigger use)
CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);