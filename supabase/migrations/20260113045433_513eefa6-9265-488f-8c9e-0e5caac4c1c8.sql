-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- The SECURITY DEFINER function runs with elevated privileges,
-- so it doesn't need an RLS policy to insert.
-- We don't need a client-side INSERT policy since notifications
-- are created by the database trigger, not by client code.