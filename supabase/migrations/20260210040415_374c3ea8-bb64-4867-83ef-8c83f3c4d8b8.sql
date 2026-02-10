
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  -- Find user_id from profiles
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE username = p_username;
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get email from auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;
  
  RETURN v_email;
END;
$function$;
