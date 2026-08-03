-- 1. Stop order rows cascading away with the listing
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_listing_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE RESTRICT;

-- 2. Block hard deletion of any listing that has orders
CREATE OR REPLACE FUNCTION public.listings_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders o WHERE o.listing_id = OLD.id) THEN
    RAISE EXCEPTION 'This item has been sold, so it cannot be deleted. You can hide it instead.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS listings_delete_guard_trg ON public.listings;
CREATE TRIGGER listings_delete_guard_trg
BEFORE DELETE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.listings_delete_guard();

-- 3. Restrict the seller delete policy to order-free listings
DROP POLICY IF EXISTS "Users can delete their own listings" ON public.listings;
CREATE POLICY "Users can delete their own listings"
ON public.listings
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.listing_id = listings.id)
);

-- 4. Removing a listing must not wipe order history
CREATE OR REPLACE FUNCTION public.cleanup_removed_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order record;
BEGIN
  IF NEW.status = 'removed' AND (OLD.status IS DISTINCT FROM 'removed') THEN
    FOR v_order IN SELECT id, buyer_id, seller_id, listing_id, status FROM orders WHERE listing_id = NEW.id LOOP
      IF v_order.status IN ('awaiting','shipped') THEN
        INSERT INTO notifications (user_id, type, title, message, related_listing_id, related_user_id, related_order_id)
        VALUES (
          v_order.buyer_id, 'order_refunded', 'Order cancelled',
          'Your order was cancelled because the listing was removed. The amount will be returned to your original payment method.',
          v_order.listing_id, v_order.seller_id, v_order.id
        );
        INSERT INTO notifications (user_id, type, title, message, related_listing_id, related_user_id, related_order_id)
        VALUES (
          v_order.seller_id, 'order_refunded', 'Order cancelled',
          'An order was cancelled because the listing was removed.',
          v_order.listing_id, v_order.buyer_id, v_order.id
        );
      END IF;
    END LOOP;

    -- Order history is preserved. Only browsing state is cleaned up.
    DELETE FROM cart_items WHERE listing_id = NEW.id;
    DELETE FROM favorites WHERE listing_id = NEW.id;
    DELETE FROM discarded_listings WHERE listing_id = NEW.id;
    DELETE FROM listing_comments WHERE listing_id = NEW.id;
    DELETE FROM notifications
      WHERE related_listing_id = NEW.id
        AND type NOT IN ('order_refunded')
        AND related_order_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;