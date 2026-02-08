-- Update listings RLS policy to exclude removed listings from public view
-- Drop existing policy and recreate with removed status filter
DROP POLICY IF EXISTS "Listings viewable by owner or same region active" ON public.listings;

CREATE POLICY "Listings viewable by owner or same region active" 
ON public.listings 
FOR SELECT 
USING (
  (auth.uid() = user_id) 
  OR (
    (status = 'active') 
    AND (region_id IS NULL OR region_id = get_user_region_id(auth.uid()))
  ) 
  OR (
    (id IN (SELECT cart_items.listing_id FROM cart_items WHERE cart_items.user_id = auth.uid())) 
    AND (region_id IS NULL OR region_id = get_user_region_id(auth.uid()))
  ) 
  OR (
    (id IN (SELECT favorites.listing_id FROM favorites WHERE favorites.user_id = auth.uid())) 
    AND (region_id IS NULL OR region_id = get_user_region_id(auth.uid()))
  )
);

-- Add index for faster report_count lookups
CREATE INDEX IF NOT EXISTS idx_listings_report_count ON public.listings(report_count) WHERE report_count > 0;
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status) WHERE status != 'active';
CREATE INDEX IF NOT EXISTS idx_reports_entity ON public.reports(report_type, reported_entity_id);