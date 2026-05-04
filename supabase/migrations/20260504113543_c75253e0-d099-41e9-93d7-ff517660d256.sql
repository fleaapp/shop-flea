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

  BEGIN
    INSERT INTO public.profiles (user_id, username, avatar_url, country_code, region_id, email)
    VALUES (
      NEW.id,
      v_username,
      NULL,
      v_country_code,
      v_region_id,
      NEW.email
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Username collision: retry with a unique suffix derived from the user id
      v_username := '@user_' || LEFT(NEW.id::text, 8);
      INSERT INTO public.profiles (user_id, username, avatar_url, country_code, region_id, email)
      VALUES (
        NEW.id,
        v_username,
        NULL,
        v_country_code,
        v_region_id,
        NEW.email
      );
  END;

  RETURN NEW;
END;
$function$;