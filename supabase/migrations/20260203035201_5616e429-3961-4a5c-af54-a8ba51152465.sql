-- Remove the foreign key constraint on notifications.user_id that references auth.users
-- This constraint is causing order placement to fail

ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;