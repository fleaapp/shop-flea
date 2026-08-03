CREATE OR REPLACE FUNCTION public.create_offer(
  p_listing_id uuid,
  p_amount numeric,
  p_message text DEFAULT NULL,
  p_parent_offer_id uuid DEFAULT NULL
)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
     SET status = CASE WHEN p_parent_offer_id IS NOT NULL THEN 'countered' ELSE 'withdrawn' END,
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
$$;

CREATE OR REPLACE FUNCTION public.claim_checkout_listings(p_listing_ids uuid[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_claimed integer;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.listings
     SET status = 'sold', updated_at = now()
   WHERE id = ANY(p_listing_ids)
     AND status = 'active';
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  IF v_claimed <> COALESCE(array_length(p_listing_ids, 1), 0) THEN
    RAISE EXCEPTION 'One or more items are no longer available';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_checkout_listings(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_checkout_listings(uuid[]) TO service_role;
