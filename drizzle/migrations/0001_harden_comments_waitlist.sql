DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.listing_comments;
CREATE POLICY "Signed-in users view comments on visible listings" ON public.listing_comments
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_comments.listing_id));

DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join waitlist with valid email" ON public.waitlist
FOR INSERT TO anon, authenticated
WITH CHECK (
  email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(email) <= 255
  AND length(country_code) <= 3
  AND notified_at IS NULL
  AND coalesce(length(first_name),0) <= 100
  AND coalesce(length(last_name),0) <= 100
);