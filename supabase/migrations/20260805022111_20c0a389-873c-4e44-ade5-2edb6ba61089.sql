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
  v_provider text;
BEGIN
  v_username := COALESCE(
    regexp_replace(left(NEW.raw_user_meta_data->>'username', 50), '[^a-zA-Z0-9_@-]', '', 'g'),
    '@user_' || LEFT(NEW.id::text, 8)
  );

  IF length(v_username) = 0 THEN
    v_username := '@user_' || LEFT(NEW.id::text, 8);
  END IF;

  v_country_code := COALESCE(NULLIF(NEW.raw_user_meta_data->>'country_code', ''), 'AU');
  v_region_id := COALESCE(NULLIF(NEW.raw_user_meta_data->>'region_id', ''), 'AU');
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  BEGIN
    INSERT INTO public.profiles (user_id, username, avatar_url, country_code, region_id, email, auth_provider)
    VALUES (NEW.id, v_username, NULL, v_country_code, v_region_id, NEW.email, v_provider);
  EXCEPTION
    WHEN unique_violation THEN
      v_username := '@user_' || LEFT(NEW.id::text, 8);
      INSERT INTO public.profiles (user_id, username, avatar_url, country_code, region_id, email, auth_provider)
      VALUES (NEW.id, v_username, NULL, v_country_code, v_region_id, NEW.email, v_provider);
  END;

  RETURN NEW;
END;
$function$;

SET LOCAL app.bypass_profile_guard = 'on';
UPDATE public.profiles
SET country_code = COALESCE(country_code, 'AU'),
    region_id = COALESCE(region_id, 'AU')
WHERE region_id IS NULL OR country_code IS NULL;