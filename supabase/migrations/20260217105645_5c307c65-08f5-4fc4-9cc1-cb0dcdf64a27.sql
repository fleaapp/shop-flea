
-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN email text;

-- Backfill existing profiles with emails from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id;

-- Update the handle_new_user trigger to also set email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_username text;
  v_country_code text;
  v_region_id text;
BEGIN
  v_username := COALESCE(
    regexp_replace(
      left(NEW.raw_user_meta_data->>'username', 50),
      '[^a-zA-Z0-9_@-]',
      '',
      'g'
    ),
    '@user_' || LEFT(NEW.id::text, 8)
  );
  
  IF length(v_username) = 0 THEN
    v_username := '@user_' || LEFT(NEW.id::text, 8);
  END IF;
  
  v_country_code := NEW.raw_user_meta_data->>'country_code';
  v_region_id := NEW.raw_user_meta_data->>'region_id';
  
  INSERT INTO public.profiles (user_id, username, avatar_url, country_code, region_id, email)
  VALUES (
    NEW.id,
    v_username,
    NULL,
    v_country_code,
    v_region_id,
    NEW.email
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;
