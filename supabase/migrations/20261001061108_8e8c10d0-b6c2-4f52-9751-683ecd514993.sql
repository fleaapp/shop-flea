CREATE OR REPLACE FUNCTION public.touch_last_active()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_sign_in_at = now()
  WHERE user_id = auth.uid()
    AND (last_sign_in_at IS NULL OR last_sign_in_at < now() - interval '5 minutes');
$$;
REVOKE ALL ON FUNCTION public.touch_last_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_active() TO authenticated;

CREATE OR REPLACE FUNCTION public.block_client_last_active_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon')
     AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    NEW.last_sign_in_at := OLD.last_sign_in_at;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS block_client_last_active_write ON public.profiles;
CREATE TRIGGER block_client_last_active_write BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.block_client_last_active_write();

UPDATE public.profiles p SET last_sign_in_at = u.last_sign_in_at
FROM auth.users u
WHERE u.id = p.user_id AND u.last_sign_in_at IS NOT NULL
  AND (p.last_sign_in_at IS NULL OR u.last_sign_in_at > p.last_sign_in_at);