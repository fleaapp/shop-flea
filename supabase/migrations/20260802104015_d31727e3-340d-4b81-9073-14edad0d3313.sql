-- 1) profiles_public: limit anonymous exposure to non-sensitive display columns
REVOKE SELECT ON public.profiles_public FROM anon;
GRANT SELECT (id, user_id, username, avatar_url, location, country_code, region_id, rating, total_reviews, pause_selling, created_at)
  ON public.profiles_public TO anon;
GRANT SELECT ON public.profiles_public TO authenticated;

-- 2) order-attachments: align INSERT ownership check with SELECT (orderId is path segment 2)
DROP POLICY IF EXISTS "Order participants can upload order attachments" ON storage.objects;
CREATE POLICY "Order participants can upload order attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-attachments'
  AND split_part(name, '/', 1) = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(name, '/', 2)
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);