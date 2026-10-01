CREATE OR REPLACE FUNCTION public.seller_is_available(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = _user_id
      AND COALESCE(p.status, 'active') NOT IN ('blocked','deleted','removed')
      AND COALESCE(p.pause_selling, false) = false
      AND (p.last_sign_in_at IS NULL OR p.last_sign_in_at >= now() - interval '10 days')
  )
$$;
GRANT EXECUTE ON FUNCTION public.seller_is_available(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_offer(p_listing_id uuid, p_amount numeric, p_message text DEFAULT NULL::text, p_parent_offer_id uuid DEFAULT NULL::uuid)
 RETURNS offers LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_listing record;
  v_offers_on boolean;
  v_direction text := 'buyer_to_seller';
  v_buyer uuid;
  v_seller uuid;
  v_round integer := 1;
  v_parent public.offers;
  v_count integer;
  v_offer public.offers;
  v_auto boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, user_id, price, status, auto_accept_offer_price
    INTO v_listing FROM public.listings WHERE id = p_listing_id;
  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.status <> 'active' THEN RAISE EXCEPTION 'This item is no longer available'; END IF;

  SELECT COALESCE(offers_enabled, false) INTO v_offers_on
  FROM public.profiles WHERE user_id = v_listing.user_id;
  IF NOT v_offers_on THEN RAISE EXCEPTION 'This seller is not accepting offers'; END IF;

  IF v_uid <> v_listing.user_id AND NOT public.seller_is_available(v_listing.user_id) THEN
    RAISE EXCEPTION 'This seller isn''t available right now';
  END IF;

  IF v_uid = v_listing.user_id THEN
    v_direction := 'seller_to_buyer';
    v_seller := v_uid;
  ELSE
    v_buyer := v_uid;
    v_seller := v_listing.user_id;
  END IF;

  IF p_parent_offer_id IS NOT NULL THEN
    SELECT * INTO v_parent FROM public.offers WHERE id = p_parent_offer_id FOR UPDATE;
    IF v_parent.id IS NULL THEN RAISE EXCEPTION 'Original offer not found'; END IF;
    IF v_parent.status <> 'pending' THEN RAISE EXCEPTION 'That offer is no longer open'; END IF;
    IF v_parent.expires_at <= now() THEN
      UPDATE public.offers SET status = 'expired', responded_at = now() WHERE id = v_parent.id;
      RAISE EXCEPTION 'That offer has expired';
    END IF;
    IF v_uid <> v_parent.buyer_id AND v_uid <> v_parent.seller_id THEN RAISE EXCEPTION 'Not authorised'; END IF;
    IF v_parent.round >= 5 THEN RAISE EXCEPTION 'You have reached the counter-offer limit for this item'; END IF;
    v_round := v_parent.round + 1;
    v_buyer := v_parent.buyer_id;
    v_seller := v_parent.seller_id;
    v_direction := CASE WHEN v_uid = v_parent.seller_id THEN 'seller_to_buyer' ELSE 'buyer_to_seller' END;
  END IF;

  IF v_direction = 'seller_to_buyer' AND v_buyer IS NULL THEN RAISE EXCEPTION 'A buyer is required for a seller offer'; END IF;
  IF p_amount >= v_listing.price THEN RAISE EXCEPTION 'Offer must be less than the asking price'; END IF;
  IF p_amount < 3 THEN RAISE EXCEPTION 'Offers must be at least $3.00'; END IF;
  IF v_direction = 'buyer_to_seller' AND p_amount < round(v_listing.price * 0.6, 2) THEN
    RAISE EXCEPTION 'Offer must be at least 60%% of the asking price';
  END IF;

  IF v_direction = 'buyer_to_seller' AND p_parent_offer_id IS NULL THEN
    SELECT count(*) INTO v_count FROM public.offers
    WHERE listing_id = p_listing_id
      AND buyer_id = v_buyer
      AND direction = 'buyer_to_seller'
      AND parent_offer_id IS NULL;
    IF v_count >= 3 THEN RAISE EXCEPTION 'You have reached the offer limit for this item'; END IF;
  END IF;

  UPDATE public.offers
     SET status = CASE
                    WHEN p_parent_offer_id IS NOT NULL THEN 'countered'
                    WHEN direction = v_direction THEN 'withdrawn'
                    ELSE 'declined'
                  END,
         responded_at = now()
   WHERE listing_id = p_listing_id AND buyer_id = v_buyer AND status = 'pending';

  v_auto := v_direction = 'buyer_to_seller'
        AND v_listing.auto_accept_offer_price IS NOT NULL
        AND p_amount >= v_listing.auto_accept_offer_price;

  INSERT INTO public.offers (
    listing_id, seller_id, buyer_id, amount, original_price, status, direction,
    parent_offer_id, round, message, expires_at, accepted_at
  ) VALUES (
    p_listing_id, v_seller, v_buyer, round(p_amount, 2), v_listing.price,
    CASE WHEN v_auto THEN 'accepted' ELSE 'pending' END,
    v_direction, p_parent_offer_id, v_round, left(COALESCE(p_message, ''), 300),
    now() + interval '24 hours', CASE WHEN v_auto THEN now() ELSE NULL END
  ) RETURNING * INTO v_offer;

  IF v_auto THEN
    INSERT INTO public.cart_items (user_id, listing_id)
    VALUES (v_offer.buyer_id, v_offer.listing_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_offer;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_order(p_order_id uuid DEFAULT NULL::uuid, p_order_group_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF orders LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_order_id IS NULL AND p_order_group_id IS NULL THEN
    RAISE EXCEPTION 'order_id or order_group_id required';
  END IF;

  IF NOT v_is_admin AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE ((p_order_id IS NOT NULL AND o.id = p_order_id)
        OR (p_order_group_id IS NOT NULL AND o.order_group_id = p_order_group_id))
      AND o.buyer_id = auth.uid()
      AND (o.disputed_at IS NOT NULL
        OR (o.refund_requested_at IS NOT NULL AND o.refund_declined_at IS NULL AND o.refunded_at IS NULL))
  ) THEN
    RAISE EXCEPTION 'This order has an open refund request or dispute, so it can''t be completed yet';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET status = 'completed',
      completed_at = now(),
      delivered_at = COALESCE(o.delivered_at, now()),
      updated_at = now()
  WHERE (o.status = 'delivered' OR (v_is_admin AND o.status IN ('delivered', 'shipped')))
    AND (o.buyer_id = auth.uid() OR v_is_admin)
    AND ((p_order_id IS NOT NULL AND o.id = p_order_id)
      OR (p_order_group_id IS NOT NULL AND o.order_group_id = p_order_group_id))
  RETURNING o.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_stale_offers()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_listing uuid;
BEGIN
  WITH updated AS (
    UPDATE public.offers o
       SET status = 'expired', responded_at = now()
     WHERE o.status IN ('pending','accepted')
       AND o.expires_at <= now()
    RETURNING o.buyer_id, o.seller_id, o.listing_id, o.direction, o.status AS new_status
  ), withtitle AS (
    SELECT u.*, l.title FROM updated u JOIN public.listings l ON l.id = u.listing_id
  ), ins_buyer AS (
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id)
    SELECT DISTINCT buyer_id, 'offer_expired', 'Offer expired',
           '⏰ Your offer on "' || title || '" has expired.', listing_id
    FROM withtitle WHERE buyer_id IS NOT NULL
    RETURNING 1
  ), ins_seller AS (
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id)
    SELECT DISTINCT seller_id, 'offer_expired', 'Offer expired',
           '⏰ An offer on "' || title || '" has expired.', listing_id
    FROM withtitle WHERE seller_id IS NOT NULL
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM updated) INTO v_count;

  FOR v_listing IN
    WITH updated AS (
      UPDATE public.offers o
         SET status = 'expired', responded_at = now()
       WHERE o.status IN ('pending','accepted')
         AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = o.listing_id AND l.status <> 'active')
      RETURNING o.listing_id
    ) SELECT DISTINCT listing_id FROM updated
  LOOP
    PERFORM public.notify_offers_voided(v_listing, 'the item is no longer available');
  END LOOP;

  RETURN v_count;
END;
$function$;
REVOKE ALL ON FUNCTION public.expire_stale_offers() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_offers() TO service_role;