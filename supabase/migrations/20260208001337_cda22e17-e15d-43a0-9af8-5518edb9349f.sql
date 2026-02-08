-- Drop the existing policies first
DROP POLICY IF EXISTS "Listings viewable via notifications same region" ON public.listings;
DROP POLICY IF EXISTS "Buyers can view order listings same region" ON public.listings;

-- Recreate them
CREATE POLICY "Listings viewable via notifications same region"
ON public.listings
FOR SELECT
USING (
  id IN (
    SELECT n.related_listing_id 
    FROM notifications n 
    WHERE n.user_id = auth.uid() AND n.related_listing_id IS NOT NULL
  )
  AND (region_id IS NULL OR region_id = get_user_region_id(auth.uid()))
);

CREATE POLICY "Buyers can view order listings same region"
ON public.listings
FOR SELECT
USING (
  id IN (SELECT o.listing_id FROM orders o WHERE o.buyer_id = auth.uid())
  AND (region_id IS NULL OR region_id = get_user_region_id(auth.uid()))
);