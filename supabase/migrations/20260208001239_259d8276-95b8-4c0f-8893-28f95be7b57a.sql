-- Update handle_new_user function to accept country_code and region_id from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_username text;
  v_avatar_url text;
  v_country_code text;
  v_region_id text;
BEGIN
  -- Validate and sanitize username from metadata
  v_username := COALESCE(
    -- Limit username length and remove potentially dangerous characters
    regexp_replace(
      left(NEW.raw_user_meta_data->>'username', 50),
      '[^a-zA-Z0-9_@-]',
      '',
      'g'
    ),
    '@user_' || LEFT(NEW.id::text, 8)
  );
  
  -- Ensure username is not empty after sanitization
  IF length(v_username) = 0 THEN
    v_username := '@user_' || LEFT(NEW.id::text, 8);
  END IF;
  
  -- Generate safe avatar URL (using fixed pattern with user ID)
  v_avatar_url := 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.id::text;
  
  -- Get country_code and region_id from user metadata (set during signup)
  v_country_code := NEW.raw_user_meta_data->>'country_code';
  v_region_id := NEW.raw_user_meta_data->>'region_id';
  
  INSERT INTO public.profiles (user_id, username, avatar_url, country_code, region_id)
  VALUES (
    NEW.id,
    v_username,
    v_avatar_url,
    v_country_code,
    v_region_id
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- Create a helper function to get user's region_id (used in RLS policies)
CREATE OR REPLACE FUNCTION public.get_user_region_id(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT region_id FROM public.profiles WHERE user_id = user_uuid
$$;

-- Create a function to check if a region is active
CREATE OR REPLACE FUNCTION public.is_region_active(region text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.regions WHERE id = region),
    false
  )
$$;