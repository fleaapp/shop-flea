-- 1. Allow the report trigger to update protected counters via a scoped bypass flag
CREATE OR REPLACE FUNCTION public.listings_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('app.bypass_report_guard', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.region_id IS DISTINCT FROM OLD.region_id
     OR NEW.report_count IS DISTINCT FROM OLD.report_count
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Modification of protected listing fields is not allowed';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('sold','removed','blocked','refunded') THEN
      RAISE EXCEPTION 'Cannot change status from %', OLD.status;
    END IF;
    IF NEW.status NOT IN ('active','paused','archived','sold','removed','refunded') THEN
      RAISE EXCEPTION 'Invalid status transition to %', NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.listing_comments_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('app.bypass_report_guard', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.report_count IS DISTINCT FROM OLD.report_count
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.listing_id IS DISTINCT FROM OLD.listing_id
     OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Modification of protected comment fields is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. process_report sets the bypass flags for its own transaction only
CREATE OR REPLACE FUNCTION public.process_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_count integer;
  v_listing_owner_id uuid;
  v_comment_author_id uuid;
  v_user_strike_count integer;
BEGIN
  PERFORM set_config('app.bypass_report_guard', 'on', true);
  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  IF NEW.report_type = 'listing' THEN
    UPDATE public.listings
    SET report_count = report_count + 1
    WHERE id = NEW.reported_entity_id
    RETURNING report_count INTO v_report_count;

    IF v_report_count > 2 THEN
      SELECT user_id INTO v_listing_owner_id
      FROM public.listings
      WHERE id = NEW.reported_entity_id;

      UPDATE public.listings
      SET status = 'removed'
      WHERE id = NEW.reported_entity_id
        AND status NOT IN ('sold','removed','blocked','refunded');

      UPDATE public.profiles
      SET report_strike_count = report_strike_count + 1
      WHERE user_id = v_listing_owner_id
      RETURNING report_strike_count INTO v_user_strike_count;

      IF v_user_strike_count > 2 THEN
        UPDATE public.profiles
        SET status = 'blocked'
        WHERE user_id = v_listing_owner_id;
      END IF;

      INSERT INTO public.notifications (user_id, type, title, message, related_listing_id)
      VALUES (
        v_listing_owner_id,
        'listing_removed',
        'Listing Removed',
        'Your listing was removed after multiple reports. Continued violations may result in account restrictions.',
        NEW.reported_entity_id
      );
    END IF;

  ELSIF NEW.report_type = 'comment' THEN
    UPDATE public.listing_comments
    SET report_count = report_count + 1
    WHERE id = NEW.reported_entity_id
    RETURNING report_count, user_id INTO v_report_count, v_comment_author_id;

    IF v_report_count > 2 THEN
      DELETE FROM public.listing_comments WHERE id = NEW.reported_entity_id;

      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        v_comment_author_id,
        'comment_removed',
        'Comment Removed',
        'Your comment was removed after multiple reports for violating Flea''s guidelines.'
      );
    END IF;

  ELSIF NEW.report_type = 'user' THEN
    UPDATE public.profiles
    SET report_strike_count = report_strike_count + 1
    WHERE user_id = NEW.reported_user_id
    RETURNING report_strike_count INTO v_user_strike_count;

    IF v_user_strike_count > 2 THEN
      UPDATE public.profiles
      SET status = 'blocked'
      WHERE user_id = NEW.reported_user_id;

      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        NEW.reported_user_id,
        'account_blocked',
        'Account Restricted',
        'Your account has been temporarily restricted due to repeated guideline violations. If you believe this is a mistake, contact support.'
      );
    END IF;
  END IF;

  PERFORM set_config('app.bypass_report_guard', 'off', true);
  PERFORM set_config('app.bypass_profile_guard', 'off', true);
  RETURN NEW;
END;
$$;

-- 3. Role-correct offer cancellation notifications
CREATE OR REPLACE FUNCTION public.notify_offers_voided(_listing_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_actor uuid := auth.uid();
BEGIN
  SELECT title INTO v_title FROM public.listings WHERE id = _listing_id;
  IF v_title IS NULL THEN RETURN; END IF;

  -- Buyers whose offers were voided
  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id)
  SELECT DISTINCT o.buyer_id,
         'offer_cancelled',
         'Offer cancelled',
         '😔 Your offer on "' || v_title || '" was cancelled - ' || _reason || '.',
         o.listing_id
  FROM public.offers o
  WHERE o.listing_id = _listing_id
    AND o.status = 'expired'
    AND o.responded_at > now() - interval '10 seconds'
    AND o.buyer_id IS DISTINCT FROM v_actor;

  -- Sellers whose outgoing discount offers were voided (never the actor)
  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id)
  SELECT DISTINCT o.seller_id,
         'offer_cancelled',
         'Offers closed',
         '🏷️ The discount offers you sent on "' || v_title || '" were closed - ' || _reason || '.',
         o.listing_id
  FROM public.offers o
  WHERE o.listing_id = _listing_id
    AND o.status = 'expired'
    AND o.responded_at > now() - interval '10 seconds'
    AND o.direction = 'seller_to_buyer'
    AND o.seller_id IS DISTINCT FROM v_actor;
END;
$$;