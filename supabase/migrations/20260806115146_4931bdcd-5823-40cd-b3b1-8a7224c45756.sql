-- C1: one accepted offer per listing
CREATE UNIQUE INDEX IF NOT EXISTS offers_one_accepted_per_listing
  ON public.offers (listing_id)
  WHERE status = 'accepted';

CREATE OR REPLACE FUNCTION public.respond_to_offer(p_offer_id uuid, p_decision text)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_listing record;
  v_offers_on boolean;
  v_other integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_decision NOT IN ('accept','decline') THEN RAISE EXCEPTION 'Invalid decision'; END IF;

  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF v_offer.status <> 'pending' THEN RAISE EXCEPTION 'This offer is no longer open'; END IF;
  IF v_offer.expires_at <= now() THEN
    UPDATE public.offers SET status = 'expired' WHERE id = p_offer_id;
    RAISE EXCEPTION 'This offer has expired';
  END IF;

  IF (v_offer.direction = 'buyer_to_seller' AND v_uid <> v_offer.seller_id)
     OR (v_offer.direction = 'seller_to_buyer' AND v_uid <> v_offer.buyer_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT COALESCE(offers_enabled, false) INTO v_offers_on
  FROM public.profiles WHERE user_id = v_offer.seller_id;
  IF p_decision = 'accept' AND NOT v_offers_on THEN
    UPDATE public.offers SET status = 'expired', responded_at = now() WHERE id = p_offer_id;
    RAISE EXCEPTION 'This seller is no longer accepting offers';
  END IF;

  SELECT id, status INTO v_listing FROM public.listings WHERE id = v_offer.listing_id FOR UPDATE;
  IF p_decision = 'accept' AND v_listing.status <> 'active' THEN
    UPDATE public.offers SET status = 'expired' WHERE id = p_offer_id;
    RAISE EXCEPTION 'This item is no longer available';
  END IF;

  IF p_decision = 'accept' THEN
    -- Another buyer must not already be holding this one-of-a-kind item.
    SELECT count(*) INTO v_other
    FROM public.offers o
    WHERE o.listing_id = v_offer.listing_id
      AND o.id <> v_offer.id
      AND o.status = 'accepted'
      AND o.expires_at > now();
    IF v_other > 0 THEN
      RAISE EXCEPTION 'Another buyer is already holding this item. It will free up if they do not pay in time.';
    END IF;

    SELECT count(*) INTO v_other
    FROM public.orders ord
    WHERE ord.listing_id = v_offer.listing_id
      AND ord.refunded_at IS NULL
      AND ord.status NOT IN ('cancelled','refunded');
    IF v_other > 0 THEN
      RAISE EXCEPTION 'This item has already been bought';
    END IF;
  END IF;

  UPDATE public.offers
     SET status = CASE WHEN p_decision = 'accept' THEN 'accepted' ELSE 'declined' END,
         accepted_at = CASE WHEN p_decision = 'accept' THEN now() ELSE NULL END,
         responded_at = now(),
         expires_at = CASE WHEN p_decision = 'accept' THEN now() + interval '24 hours' ELSE expires_at END
   WHERE id = p_offer_id
  RETURNING * INTO v_offer;

  IF v_offer.status = 'accepted' THEN
    INSERT INTO public.cart_items (user_id, listing_id)
    VALUES (v_offer.buyer_id, v_offer.listing_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_offer;
END;
$$;

-- C2: never auto-complete an order with an open refund request
CREATE OR REPLACE FUNCTION public.auto_complete_delivered_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.orders
  SET dispute_window_ends_at = delivered_at + interval '2 days',
      pending_admin_delivery_review = false,
      updated_at = now()
  WHERE status = 'delivered'
    AND dispute_window_ends_at IS NULL
    AND delivered_at IS NOT NULL
    AND delivered_at <= now() - interval '7 days'
    AND refunded_at IS NULL
    AND completed_at IS NULL;

  WITH updated AS (
    UPDATE public.orders
    SET status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE status = 'delivered'
      AND COALESCE(pending_admin_delivery_review, false) = false
      AND dispute_window_ends_at IS NOT NULL
      AND dispute_window_ends_at <= now()
      -- An open refund request must be settled before funds release.
      AND (refund_requested_at IS NULL OR refund_declined_at IS NOT NULL)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- H1: one coupon redemption per account, enforced in the database
DELETE FROM public.coupon_redemptions cr
USING public.coupon_redemptions keep
WHERE cr.coupon_id = keep.coupon_id
  AND cr.user_id = keep.user_id
  AND cr.created_at > keep.created_at;

DELETE FROM public.coupon_redemptions cr
USING public.coupon_redemptions keep
WHERE cr.coupon_id = keep.coupon_id
  AND cr.user_id = keep.user_id
  AND cr.created_at = keep.created_at
  AND cr.id > keep.id;

CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_one_per_user
  ON public.coupon_redemptions (coupon_id, user_id);

-- M1: pausing a listing must not void live offers
CREATE OR REPLACE FUNCTION public.void_offers_on_listing_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voided integer := 0;
  v_reason text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('sold','removed','deleted','archived') THEN
    v_reason := 'the item is no longer available';
  ELSIF NEW.price IS DISTINCT FROM OLD.price THEN
    v_reason := 'the seller changed the price';
  ELSE
    RETURN NEW;
  END IF;

  WITH updated AS (
    UPDATE public.offers
       SET status = 'expired', responded_at = now()
     WHERE listing_id = NEW.id AND status IN ('pending','accepted')
    RETURNING 1
  ) SELECT count(*) INTO v_voided FROM updated;

  IF v_voided > 0 THEN
    PERFORM public.notify_offers_voided(NEW.id, v_reason);
  END IF;

  RETURN NEW;
END;
$$;