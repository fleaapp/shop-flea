-- Drop the existing policy
DROP POLICY IF EXISTS "Active listings are viewable by everyone" ON public.listings;

-- Create updated policy that allows viewing sold listings in cart/favorites
CREATE POLICY "Listings viewable by owner or in cart/favorites or active" 
ON public.listings 
FOR SELECT 
USING (
  status = 'active' 
  OR auth.uid() = user_id
  OR id IN (SELECT listing_id FROM public.cart_items WHERE user_id = auth.uid())
  OR id IN (SELECT listing_id FROM public.favorites WHERE user_id = auth.uid())
);