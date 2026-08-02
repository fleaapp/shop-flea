CREATE OR REPLACE FUNCTION public.get_listing_engagement_counts(_listing_ids uuid[])
RETURNS TABLE(listing_id uuid, cart_count integer, wishlist_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ids AS (
    SELECT DISTINCT unnest(_listing_ids) AS id LIMIT 100
  )
  SELECT
    ids.id,
    (SELECT count(*)::int FROM public.cart_items ci WHERE ci.listing_id = ids.id),
    (SELECT count(*)::int FROM public.favorites f WHERE f.listing_id = ids.id)
  FROM ids;
$$;

REVOKE ALL ON FUNCTION public.get_listing_engagement_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_engagement_counts(uuid[]) TO anon, authenticated, service_role;