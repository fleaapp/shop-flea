CREATE OR REPLACE FUNCTION public.notify_users_on_listing_sold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_title text;
  v_listing_user_id uuid;
  v_group_listing_ids uuid[];
  v_seller_count int := 1;
  v_existing_id uuid;
  v_existing_type text;
  w record;
  v_in_cart boolean;
  v_in_wish boolean;
  v_cart_count int;
  v_wish_count int;
  v_total_count int;
  v_place text;
  v_msg text;
BEGIN
  SELECT title, user_id INTO v_listing_title, v_listing_user_id
  FROM public.listings WHERE id = NEW.listing_id;

  IF v_listing_title IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.order_group_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT o.listing_id) INTO v_group_listing_ids
    FROM public.orders o WHERE o.order_group_id = NEW.order_group_id;
  ELSE
    v_group_listing_ids := ARRAY[NEW.listing_id];
  END IF;

  -- ===== Seller alert: one per checkout group, bundle-aware copy =====
  IF NEW.order_group_id IS NOT NULL THEN
    SELECT count(*)::int INTO v_seller_count
    FROM public.orders o
    WHERE o.order_group_id = NEW.order_group_id
      AND o.seller_id = v_listing_user_id;

    SELECT n.id INTO v_existing_id
    FROM public.notifications n
    JOIN public.orders o ON o.id = n.related_order_id
     AND o.order_group_id = NEW.order_group_id
    WHERE n.type = 'item_sold'
      AND n.user_id = v_listing_user_id
    LIMIT 1;
  END IF;

  IF v_seller_count IS NULL OR v_seller_count < 1 THEN
    v_seller_count := 1;
  END IF;

  IF v_seller_count > 1 THEN
    v_msg := '🎉🤑 Cha-ching! Your bundle of ' || v_seller_count || ' items has just sold. Tap to view the order.';
  ELSE
    v_msg := '🎉🤑 Cha-ching! Your item "' || v_listing_title || '" has just sold. Tap to view the order.';
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.notifications SET message = v_msg WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id, related_order_id)
    VALUES (v_listing_user_id, 'item_sold', 'Item Sold', v_msg, NEW.listing_id, NEW.buyer_id, NEW.id);
  END IF;

  -- ===== Watchers (cart / wishlist): one grouped alert per checkout =====
  FOR w IN
    SELECT u.user_id
    FROM (
      SELECT ci.user_id FROM public.cart_items ci WHERE ci.listing_id = NEW.listing_id
      UNION
      SELECT f.user_id FROM public.favorites f WHERE f.listing_id = NEW.listing_id
    ) u
    WHERE u.user_id <> v_listing_user_id AND u.user_id <> NEW.buyer_id
  LOOP
    SELECT EXISTS (SELECT 1 FROM public.cart_items ci WHERE ci.listing_id = NEW.listing_id AND ci.user_id = w.user_id) INTO v_in_cart;
    SELECT EXISTS (SELECT 1 FROM public.favorites f WHERE f.listing_id = NEW.listing_id AND f.user_id = w.user_id) INTO v_in_wish;

    SELECT count(DISTINCT ci.listing_id)::int INTO v_cart_count
    FROM public.cart_items ci
    WHERE ci.user_id = w.user_id AND ci.listing_id = ANY(v_group_listing_ids);

    SELECT count(DISTINCT f.listing_id)::int INTO v_wish_count
    FROM public.favorites f
    WHERE f.user_id = w.user_id AND f.listing_id = ANY(v_group_listing_ids);

    SELECT count(*)::int INTO v_total_count
    FROM unnest(v_group_listing_ids) AS l(id)
    WHERE EXISTS (SELECT 1 FROM public.cart_items ci WHERE ci.user_id = w.user_id AND ci.listing_id = l.id)
       OR EXISTS (SELECT 1 FROM public.favorites f WHERE f.user_id = w.user_id AND f.listing_id = l.id);

    IF v_cart_count > 0 AND v_wish_count > 0 THEN
      v_place := 'cart and wishlist';
    ELSIF v_cart_count > 0 THEN
      v_place := 'cart';
    ELSE
      v_place := 'wishlist';
    END IF;

    IF v_total_count > 1 THEN
      v_msg := '😞 ' || v_total_count || ' items from your ' || v_place || ' have just sold.';
    ELSE
      v_msg := '😞 "' || v_listing_title || '" from your ' ||
        (CASE WHEN v_in_cart AND v_in_wish THEN 'cart and wishlist' WHEN v_in_cart THEN 'cart' ELSE 'wishlist' END) ||
        ' has just sold.';
    END IF;

    v_existing_id := NULL;
    SELECT n.id, n.type INTO v_existing_id, v_existing_type
    FROM public.notifications n
    WHERE n.user_id = w.user_id
      AND n.type IN ('cart_item_sold', 'wishlist_item_sold', 'cart_wishlist_item_sold')
      AND n.related_listing_id = ANY(v_group_listing_ids)
      AND n.created_at > now() - interval '1 hour'
    ORDER BY n.created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.notifications SET message = v_msg WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
      VALUES (
        w.user_id,
        CASE WHEN v_in_cart AND v_in_wish THEN 'cart_wishlist_item_sold' WHEN v_in_cart THEN 'cart_item_sold' ELSE 'wishlist_item_sold' END,
        'Item Sold',
        v_msg,
        NEW.listing_id,
        NEW.buyer_id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;