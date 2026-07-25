-- Admin buyer-protection support: allow admins to view all orders for the approval queue.
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));