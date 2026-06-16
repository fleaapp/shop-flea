
-- search_queries: prevent user_id spoofing
DROP POLICY IF EXISTS "Anyone can insert search queries" ON public.search_queries;
CREATE POLICY "Anyone can insert search queries"
ON public.search_queries
FOR INSERT
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- listings: tighten WITH CHECK to re-validate ownership and region
DROP POLICY IF EXISTS "Users can update their own listings" ON public.listings;
CREATE POLICY "Users can update their own listings"
ON public.listings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (region_id IS NULL OR region_id = public.get_user_region_id(auth.uid()))
);
