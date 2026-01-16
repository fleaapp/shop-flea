-- Allow buyers to create orders
CREATE POLICY "Buyers can create orders"
ON public.orders
FOR INSERT
WITH CHECK (auth.uid() = buyer_id);