-- ============ columns ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS offers_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS auto_accept_offer_price numeric;

-- expose on the public view mirror
ALTER TABLE public.profiles_public ADD COLUMN IF NOT EXISTS offers_enabled boolean DEFAULT false;
GRANT SELECT (offers_enabled) ON public.profiles_public TO anon, authenticated;

-- ============ offers table ============
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  amount numeric NOT NULL,
  original_price numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  direction text NOT NULL DEFAULT 'buyer_to_seller',
  parent_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  round integer NOT NULL DEFAULT 1,
  message text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  accepted_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_status_valid CHECK (status IN ('pending','accepted','declined','countered','expired','withdrawn')),
  CONSTRAINT offers_direction_valid CHECK (direction IN ('buyer_to_seller','seller_to_buyer')),
  CONSTRAINT offers_amount_positive CHECK (amount > 0)
);

GRANT SELECT, INSERT, UPDATE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their offers"
ON public.offers FOR SELECT TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));

-- writes go through SECURITY DEFINER rpcs only; no INSERT/UPDATE policies.

CREATE INDEX IF NOT EXISTS offers_buyer_idx ON public.offers(buyer_id, status);
CREATE INDEX IF NOT EXISTS offers_seller_idx ON public.offers(seller_id, status);
CREATE INDEX IF NOT EXISTS offers_listing_idx ON public.offers(listing_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS offers_one_pending_per_buyer
  ON public.offers(listing_id, buyer_id) WHERE status = 'pending';

CREATE TRIGGER offers_set_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ create_offer ============
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
    SELECT * INTO v_parent FROM public.offers WHERE id = p_parent_offer_id;
    IF v_parent.id IS NULL THEN RAISE EXCEPTION 'Original offer not found'; END IF;
    IF v_parent.status <> 'pending' THEN RAISE EXCEPTION 'That offer is no longer open'; END IF;
    IF v_uid <> v_parent.buyer_id AND v_uid <> v_parent.seller_id THEN
      RAISE EXCEPTION 'Not authorised';
    END IF;
    IF v_parent.round >= 5 THEN RAISE EXCEPTION 'You have reached the counter-offer limit for this item'; END IF;
    v_round := v_parent.round + 1;
    v_buyer := v_parent.buyer_id;
    v_seller := v_parent.seller_id;
    v_direction := CASE WHEN v_uid = v_parent.seller_id THEN 'seller_to_buyer' ELSE 'buyer_to_seller' END;
  END IF;

  IF v_direction = 'seller_to_buyer' AND v_buyer IS NULL THEN
    RAISE EXCEPTION 'A buyer is required for a seller offer';
  END IF;

  -- price rules
  IF p_amount >= v_listing.price THEN
    RAISE EXCEPTION 'Offer must be less than the asking price';
  END IF;
  IF p_amount < 3 THEN
    RAISE EXCEPTION 'Offers must be at least $3.00';
  END IF;
  IF v_direction = 'buyer_to_seller' AND p_amount < round(v_listing.price * 0.6, 2) THEN
    RAISE EXCEPTION 'Offer must be at least 60%% of the asking price';
  END IF;

  -- 3 offers per buyer per listing (buyer-originated only, excludes counters they receive)
  IF v_direction = 'buyer_to_seller' THEN
    SELECT count(*) INTO v_count FROM public.offers
    WHERE listing_id = p_listing_id AND buyer_id = v_buyer AND direction = 'buyer_to_seller';
    IF v_count >= 3 THEN RAISE EXCEPTION 'You have reached the offer limit for this item'; END IF;
  END IF;

  -- supersede any open offer between these two on this listing
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
    now() + interval '24 hours',
    CASE WHEN v_auto THEN now() ELSE NULL END
  ) RETURNING * INTO v_offer;

  RETURN v_offer;
END;
$$;

-- ============ respond_to_offer ============
CREATE OR REPLACE FUNCTION public.respond_to_offer(p_offer_id uuid, p_decision text)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_listing record;
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

  -- only the recipient may respond
  IF (v_offer.direction = 'buyer_to_seller' AND v_uid <> v_offer.seller_id)
     OR (v_offer.direction = 'seller_to_buyer' AND v_uid <> v_offer.buyer_id) THEN
    RAISE EXCEPTION 'Not authorised';
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

  -- accepted offers drop the item into the buyer's cart
  IF v_offer.status = 'accepted' THEN
    INSERT INTO public.cart_items (user_id, listing_id)
    VALUES (v_offer.buyer_id, v_offer.listing_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_offer;
END;
$$;

-- ============ withdraw_offer ============
CREATE OR REPLACE FUNCTION public.withdraw_offer(p_offer_id uuid)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_offer public.offers;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF v_offer.status <> 'pending' THEN RAISE EXCEPTION 'This offer is no longer open'; END IF;

  IF (v_offer.direction = 'buyer_to_seller' AND v_uid <> v_offer.buyer_id)
     OR (v_offer.direction = 'seller_to_buyer' AND v_uid <> v_offer.seller_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.offers SET status = 'withdrawn', responded_at = now()
   WHERE id = p_offer_id RETURNING * INTO v_offer;
  RETURN v_offer;
END;
$$;

-- ============ accepted offer price resolver (used by checkout) ============
CREATE OR REPLACE FUNCTION public.get_accepted_offer_prices(_buyer_id uuid, _listing_ids uuid[])
RETURNS TABLE(listing_id uuid, offer_id uuid, amount numeric, original_price numeric, expires_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ON (o.listing_id)
         o.listing_id, o.id, o.amount, o.original_price, o.expires_at
  FROM public.offers o
  WHERE o.buyer_id = _buyer_id
    AND o.listing_id = ANY(_listing_ids)
    AND o.status = 'accepted'
    AND o.expires_at > now()
  ORDER BY o.listing_id, o.accepted_at DESC
$$;

REVOKE ALL ON FUNCTION public.get_accepted_offer_prices(uuid, uuid[]) FROM anon;

-- ============ expiry sweeper ============
CREATE OR REPLACE FUNCTION public.expire_stale_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.offers o
       SET status = 'expired', responded_at = now()
     WHERE o.status IN ('pending','accepted')
       AND o.expires_at <= now()
    RETURNING 1
  ) SELECT count(*) INTO v_count FROM updated;

  -- void offers on items that are no longer purchasable
  UPDATE public.offers o
     SET status = 'expired', responded_at = now()
   WHERE o.status IN ('pending','accepted')
     AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = o.listing_id AND l.status <> 'active');

  RETURN v_count;
END;
$$;

-- ============ void offers when a listing leaves active ============
CREATE OR REPLACE FUNCTION public.void_offers_on_listing_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'active' THEN
    UPDATE public.offers
       SET status = 'expired', responded_at = now()
     WHERE listing_id = NEW.id AND status IN ('pending','accepted');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_void_offers_on_listing_change ON public.listings;
CREATE TRIGGER trg_void_offers_on_listing_change
AFTER UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.void_offers_on_listing_change();