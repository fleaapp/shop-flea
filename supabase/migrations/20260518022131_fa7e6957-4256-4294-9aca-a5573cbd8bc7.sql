
-- 1. Notifications: remove broad INSERT policy (server-side only via service role)
DROP POLICY IF EXISTS "Users can create notifications for others" ON public.notifications;

-- 2. Brands: restrict UPDATE so only usage_count can change
CREATE OR REPLACE FUNCTION public.brands_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.brand_name IS DISTINCT FROM OLD.brand_name
     OR NEW.display_name IS DISTINCT FROM OLD.display_name
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only usage_count may be updated on brands';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS brands_update_guard_trg ON public.brands;
CREATE TRIGGER brands_update_guard_trg
BEFORE UPDATE ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.brands_update_guard();

-- 3. Order attachments: make bucket private + scope reads to order participants
UPDATE storage.buckets SET public = false WHERE id = 'order-attachments';

DROP POLICY IF EXISTS "Order attachments are publicly readable" ON storage.objects;

CREATE POLICY "Order participants can read order attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = split_part(storage.objects.name, '/', 1)
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);
