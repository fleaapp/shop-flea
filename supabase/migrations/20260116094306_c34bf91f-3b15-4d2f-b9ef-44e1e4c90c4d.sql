-- Allow buyers to view listings from their orders
CREATE POLICY "Buyers can view listings from their orders"
ON public.listings
FOR SELECT
USING (
  id IN (
    SELECT o.listing_id 
    FROM public.orders o 
    WHERE o.buyer_id = auth.uid()
  )
);