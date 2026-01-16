-- Allow users to view listing thumbnails for items referenced by their own notifications
-- (Fixes notifications showing fallback emoji because listing fetch returns 0 rows under current listings SELECT policy)

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listings viewable via notifications"
ON public.listings
FOR SELECT
TO public
USING (
  id IN (
    SELECT n.related_listing_id
    FROM public.notifications n
    WHERE n.user_id = auth.uid()
      AND n.related_listing_id IS NOT NULL
  )
);
