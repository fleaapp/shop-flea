DROP POLICY IF EXISTS "Users can create reviews for their delivered orders" ON public.reviews;

CREATE POLICY "Users can create reviews for their delivered orders"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reviewer_id
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = reviews.order_id
      AND o.status IN ('delivered', 'completed')
      AND (
        (o.buyer_id = auth.uid() AND reviews.reviewed_user_id = o.seller_id)
        OR (o.seller_id = auth.uid() AND reviews.reviewed_user_id = o.buyer_id)
      )
  )
);