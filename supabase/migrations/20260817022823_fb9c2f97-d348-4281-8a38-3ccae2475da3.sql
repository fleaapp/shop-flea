ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_order_notifications boolean DEFAULT true;

COMMENT ON COLUMN public.profiles.email_order_notifications IS 'Whether the user wants order/sale transactional emails.';

GRANT SELECT (email_order_notifications) ON public.profiles TO authenticated;
GRANT UPDATE (email_order_notifications) ON public.profiles TO authenticated;