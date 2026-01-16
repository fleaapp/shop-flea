-- Create a trigger to automatically mark listing as sold when an order is created
CREATE OR REPLACE FUNCTION public.mark_listing_as_sold()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.listings
  SET status = 'sold', updated_at = now()
  WHERE id = NEW.listing_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
CREATE TRIGGER on_order_created_mark_listing_sold
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.mark_listing_as_sold();