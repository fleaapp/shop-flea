
-- 1. listing_comments guard
CREATE OR REPLACE FUNCTION public.listing_comments_update_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.report_count IS DISTINCT FROM OLD.report_count
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.listing_id IS DISTINCT FROM OLD.listing_id
     OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Modification of protected comment fields is not allowed';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS listing_comments_update_guard_trg ON public.listing_comments;
CREATE TRIGGER listing_comments_update_guard_trg
BEFORE UPDATE ON public.listing_comments
FOR EACH ROW EXECUTE FUNCTION public.listing_comments_update_guard();

DROP POLICY IF EXISTS "Users can update their own comments" ON public.listing_comments;
CREATE POLICY "Users can update their own comments"
ON public.listing_comments FOR UPDATE
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. listings guard
CREATE OR REPLACE FUNCTION public.listings_update_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.region_id IS DISTINCT FROM OLD.region_id
     OR NEW.report_count IS DISTINCT FROM OLD.report_count
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Modification of protected listing fields is not allowed';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('sold','removed','blocked') THEN
      RAISE EXCEPTION 'Cannot change status from %', OLD.status;
    END IF;
    IF NEW.status NOT IN ('active','paused','archived') THEN
      RAISE EXCEPTION 'Invalid status transition to %', NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS listings_update_guard_trg ON public.listings;
CREATE TRIGGER listings_update_guard_trg
BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.listings_update_guard();

DROP POLICY IF EXISTS "Users can update their own listings" ON public.listings;
CREATE POLICY "Users can update their own listings"
ON public.listings FOR UPDATE
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. payment_events: restrict payload column from buyers/sellers
REVOKE SELECT ON public.payment_events FROM authenticated;
REVOKE SELECT ON public.payment_events FROM anon;
GRANT SELECT (id, provider, event_id, event_type, order_id, buyer_id, seller_id, amount, created_at)
  ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
