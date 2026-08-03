
-- M3: stop auto-delivering unscanned parcels; queue them for admin review instead.
CREATE OR REPLACE FUNCTION public.auto_deliver_shipped_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.orders
    SET pending_admin_delivery_review = true,
        updated_at = now()
    WHERE status = 'shipped'
      AND tracking_approved_at IS NOT NULL
      AND shipped_at IS NOT NULL
      AND shipped_at <= now() - interval '10 days'
      AND delivered_at IS NULL
      AND refunded_at IS NULL
      AND refund_requested_at IS NULL
      AND pending_admin_delivery_review = false
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- M7: offers toggle is a real kill switch.
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

  SELECT id, status INTO v_listing FROM public.listings WHERE id = v_offer.listing_id;
  IF p_decision = 'accept' AND v_listing.status <> 'active' THEN
    UPDATE public.offers SET status = 'expired' WHERE id = p_offer_id;
    RAISE EXCEPTION 'This item is no longer available';
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

CREATE OR REPLACE FUNCTION public.close_offers_when_disabled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.offers_enabled, false) = true AND COALESCE(NEW.offers_enabled, false) = false THEN
    UPDATE public.offers
       SET status = 'expired', responded_at = now()
     WHERE seller_id = NEW.user_id
       AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_offers_when_disabled ON public.profiles;
CREATE TRIGGER trg_close_offers_when_disabled
AFTER UPDATE OF offers_enabled ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.close_offers_when_disabled();
