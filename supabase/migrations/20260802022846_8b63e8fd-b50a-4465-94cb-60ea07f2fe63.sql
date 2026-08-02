CREATE OR REPLACE FUNCTION public.notify_on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_listing_title text;
  v_other_titles text[];
  v_combined_title text;
BEGIN
  SELECT title INTO v_listing_title
  FROM public.listings WHERE id = NEW.listing_id;

  -- Shipped notification to buyer
  IF OLD.status = 'awaiting' AND NEW.status = 'shipped' THEN
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
      '✈️ Your order ' || v_combined_title || ' is on the way. Tap for details.',
      NEW.listing_id,
      NEW.seller_id,
      NEW.id
    );
  END IF;

  -- Delivered notifications to BOTH buyer and seller
  IF OLD.status = 'shipped' AND NEW.status = 'delivered' THEN
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

    -- Buyer
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

    -- Seller
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id, related_order_id)
    VALUES (
      NEW.seller_id,
      'sale_delivered',
      'Sale Delivered',
      '🏠 ' || v_combined_title || ' was delivered. Your funds release 48 hours from now.',
      NEW.listing_id,
      NEW.buyer_id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;