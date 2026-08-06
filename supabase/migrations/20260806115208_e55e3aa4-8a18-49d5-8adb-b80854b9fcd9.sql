CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  IF p_username IS NULL OR length(trim(p_username)) < 1 OR length(p_username) > 50 THEN
    RETURN NULL;
  END IF;

  p_username := trim(p_username);

  -- Throttle harvesting: per-username and global buckets.
  IF NOT public.check_and_record_rate_limit('email_lookup:' || lower(p_username), 8, 300) THEN
    RAISE EXCEPTION 'Too many attempts. Please wait a moment and try again.';
  END IF;
  IF NOT public.check_and_record_rate_limit('email_lookup_global', 300, 60) THEN
    RAISE EXCEPTION 'Too many attempts. Please wait a moment and try again.';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE username = p_username;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  RETURN v_email;
END;
$$;