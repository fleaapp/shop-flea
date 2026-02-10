
CREATE POLICY "Sold listings viewable by same region users"
ON public.listings
FOR SELECT
USING (
  status = 'sold'
  AND (region_id IS NULL OR region_id = get_user_region_id(auth.uid()))
);
