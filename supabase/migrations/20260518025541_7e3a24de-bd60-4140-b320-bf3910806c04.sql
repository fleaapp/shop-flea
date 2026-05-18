
-- 1. Tighten storage INSERT policy for order-attachments
DROP POLICY IF EXISTS "Authenticated users can upload order attachments" ON storage.objects;

CREATE POLICY "Order participants can upload order attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-attachments'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(storage.objects.name, '/', 1)
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- 2. Brands: tighten INSERT and UPDATE
DROP POLICY IF EXISTS "Authenticated users can add brands" ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can update brand usage" ON public.brands;

CREATE POLICY "Authenticated users can add brands"
ON public.brands
FOR INSERT
TO authenticated
WITH CHECK (
  length(brand_name) BETWEEN 1 AND 100
  AND length(display_name) BETWEEN 1 AND 100
  AND brand_name = lower(brand_name)
);

-- UPDATE policy: still relies on brands_update_guard trigger to block
-- changes to brand_name / display_name. Keep policy authenticated-only.
CREATE POLICY "Authenticated users can update brand usage_count"
ON public.brands
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Notifications: explicit restrictive INSERT block for regular users.
-- Server (service_role) bypasses RLS so triggers/edge functions still work.
CREATE POLICY "Block client-side notification inserts"
ON public.notifications
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);
