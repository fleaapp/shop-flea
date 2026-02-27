
-- Add last_sign_in_at column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_sign_in_at timestamp with time zone DEFAULT now();

-- Set existing profiles to now() so they aren't immediately inactive
UPDATE public.profiles SET last_sign_in_at = now() WHERE last_sign_in_at IS NULL;

-- Create a function to update last_sign_in_at when user signs in
CREATE OR REPLACE FUNCTION public.update_last_sign_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE public.profiles
    SET last_sign_in_at = NEW.last_sign_in_at
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger on auth.users to track sign-ins
CREATE TRIGGER on_auth_user_sign_in
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_last_sign_in();
