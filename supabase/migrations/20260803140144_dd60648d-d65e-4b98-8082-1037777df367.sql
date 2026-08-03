
-- Helper: notify the counterparty when an offer is voided
CREATE OR REPLACE FUNCTION public.notify_offers_voided(_listing_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title text;
BEGIN
  SELECT title INTO v_title FROM public.listings WHERE id = _listing_id;
  IF v_title IS NULL THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id)
  SELECT o.buyer_id,
         'offer_cancelled',
         'Offer cancelled',
         '😔 Your offer on "' || v_title || '" was cancelled - ' || _reason || '.',
         o.listing_id
  FROM public.offers o
  WHERE o.listing_id = _listing_id
    AND o.status = 'expired'
    AND o.responded_at > now() - interval '10 seconds';

  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id)
  SELECT DISTINCT o.seller_id,
         'offer_cancelled',
         'Offer cancelled',
         '😔 Open offers on "' || v_title || '" were cancelled - ' || _reason || '.',
         o.listing_id
  FROM public.offers o
  WHERE o.listing_id = _listing_id
    AND o.status = 'expired'
    AND o.responded_at > now() - interval '10 seconds'
    AND o.direction = 'seller_to_buyer';
END;
$$;

REVOKE ALL ON FUNCTION public.notify_offers_voided(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_offers_voided(uuid, text) TO service_role;

-- Void offers on listing status OR price change, and notify
CREATE OR REPLACE FUNCTION public.void_offers_on_listing_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_voided integer := 0;
  v_reason text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'active' THEN
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

-- Scheduled clean-up now notifies too
CREATE OR REPLACE FUNCTION public.expire_stale_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
  v_listing uuid;
BEGIN
  WITH updated AS (
    UPDATE public.offers o
       SET status = 'expired', responded_at = now()
     WHERE o.status IN ('pending','accepted')
       AND o.expires_at <= now()
    RETURNING 1
  ) SELECT count(*) INTO v_count FROM updated;

  FOR v_listing IN
    WITH updated AS (
      UPDATE public.offers o
         SET status = 'expired', responded_at = now()
       WHERE o.status IN ('pending','accepted')
         AND EXISTS (
           SELECT 1 FROM public.listings l
            WHERE l.id = o.listing_id AND l.status <> 'active'
         )
      RETURNING o.listing_id
    ) SELECT DISTINCT listing_id FROM updated
  LOOP
    PERFORM public.notify_offers_voided(v_listing, 'the item is no longer available');
  END LOOP;

  RETURN v_count;
END;
$$;

-- Remind buyers before an accepted offer's 24h payment window closes
CREATE OR REPLACE FUNCTION public.notify_expiring_accepted_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH due AS (
    SELECT o.id, o.buyer_id, o.listing_id, o.amount, l.title
    FROM public.offers o
    JOIN public.listings l ON l.id = o.listing_id
    WHERE o.status = 'accepted'
      AND o.expires_at > now()
      AND o.expires_at <= now() + interval '4 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = o.buyer_id
          AND n.type = 'offer_expiring'
          AND n.related_listing_id = o.listing_id
          AND n.created_at > o.accepted_at
      )
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, message, related_listing_id)
    SELECT buyer_id,
           'offer_expiring',
           'Offer expiring soon',
           '⏳ Your accepted $' || trim(to_char(amount, 'FM999999990.00')) ||
           ' offer on "' || title || '" expires in under 4 hours. Check out now to keep the price.',
           listing_id
    FROM due
    RETURNING 1
  ) SELECT count(*) INTO v_count FROM ins;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_expiring_accepted_offers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_expiring_accepted_offers() TO service_role;

-- Run the reminder alongside the existing 10-minute offer sweep
SELECT cron.unschedule('offers-expiry-reminder') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'offers-expiry-reminder'
);
SELECT cron.schedule(
  'offers-expiry-reminder',
  '*/30 * * * *',
  $cron$ SELECT public.notify_expiring_accepted_offers(); $cron$
);
