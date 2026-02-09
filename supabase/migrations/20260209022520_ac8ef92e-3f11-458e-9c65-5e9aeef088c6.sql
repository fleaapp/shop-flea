-- Create function to notify users when a listing they favorited/carted is sold
CREATE OR REPLACE FUNCTION public.notify_wishlist_cart_on_sold()
RETURNS TRIGGER AS $$
DECLARE
  listing_title TEXT;
  user_record RECORD;
  in_favorites BOOLEAN;
  in_cart BOOLEAN;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the listing title
  SELECT title INTO listing_title FROM public.listings WHERE id = NEW.listing_id;
  
  -- Find all users who have this listing in favorites or cart (excluding the buyer)
  FOR user_record IN
    SELECT DISTINCT user_id
    FROM (
      SELECT user_id FROM public.favorites WHERE listing_id = NEW.listing_id
      UNION
      SELECT user_id FROM public.cart_items WHERE listing_id = NEW.listing_id
    ) AS combined
    WHERE user_id != NEW.buyer_id
  LOOP
    -- Check if in favorites
    SELECT EXISTS(
      SELECT 1 FROM public.favorites 
      WHERE listing_id = NEW.listing_id AND user_id = user_record.user_id
    ) INTO in_favorites;
    
    -- Check if in cart
    SELECT EXISTS(
      SELECT 1 FROM public.cart_items 
      WHERE listing_id = NEW.listing_id AND user_id = user_record.user_id
    ) INTO in_cart;
    
    -- Determine notification content
    IF in_favorites AND in_cart THEN
      notification_title := 'Item in your Wishlist & Cart was sold';
      notification_message := '"' || listing_title || '" has been sold';
    ELSIF in_favorites THEN
      notification_title := 'Item in your Wishlist was sold';
      notification_message := '"' || listing_title || '" has been sold';
    ELSIF in_cart THEN
      notification_title := 'Item in your Cart was sold';
      notification_message := '"' || listing_title || '" has been sold';
    END IF;
    
    -- Create the notification
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      related_listing_id
    ) VALUES (
      user_record.user_id,
      'listing_sold',
      notification_title,
      notification_message,
      NEW.listing_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS notify_wishlist_cart_on_order_created ON public.orders;
CREATE TRIGGER notify_wishlist_cart_on_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_wishlist_cart_on_sold();