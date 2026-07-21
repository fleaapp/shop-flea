
-- Drop duplicate triggers (keep canonical trg_ versions)
DROP TRIGGER IF EXISTS on_order_created_mark_listing_sold ON public.orders;
DROP TRIGGER IF EXISTS orders_mark_listing_as_sold_after_insert ON public.orders;
DROP TRIGGER IF EXISTS set_order_number ON public.orders;
DROP TRIGGER IF EXISTS orders_generate_order_number_before_insert ON public.orders;
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;

DROP TRIGGER IF EXISTS on_profile_delete_cleanup ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_status_cleanup ON public.profiles;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

DROP TRIGGER IF EXISTS update_listings_updated_at ON public.listings;

DROP TRIGGER IF EXISTS update_rating_on_review_insert ON public.reviews;
DROP TRIGGER IF EXISTS update_rating_on_review_update ON public.reviews;
DROP TRIGGER IF EXISTS update_rating_on_review_delete ON public.reviews;

DROP TRIGGER IF EXISTS on_report_created ON public.reports;

DROP TRIGGER IF EXISTS set_saved_searches_updated_at ON public.saved_searches;

DROP TRIGGER IF EXISTS set_waitlist_region_trigger ON public.waitlist;

-- Ensure the canonical review rating trigger covers INSERT/UPDATE/DELETE.
DROP TRIGGER IF EXISTS trg_update_user_rating ON public.reviews;
CREATE TRIGGER trg_update_user_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_user_rating();

-- Clean up exact-duplicate notifications from the last 24h
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, type,
        COALESCE(related_order_id::text,''),
        COALESCE(related_thread_id::text,''),
        COALESCE(related_listing_id::text,''),
        COALESCE(related_user_id::text,''),
        created_at
      ORDER BY id
    ) AS rn
  FROM public.notifications
  WHERE created_at > now() - interval '24 hours'
)
DELETE FROM public.notifications n USING ranked r
WHERE n.id = r.id AND r.rn > 1;
