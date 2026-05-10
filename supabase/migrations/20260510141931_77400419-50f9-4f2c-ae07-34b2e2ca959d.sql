
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id bigserial PRIMARY KEY,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_time
  ON public.rate_limits (key, created_at DESC);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_and_record_rate_limit(
  _key text,
  _max int,
  _window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  DELETE FROM public.rate_limits
  WHERE key = _key
    AND created_at < now() - (_window_seconds || ' seconds')::interval;

  SELECT COUNT(*) INTO v_count
  FROM public.rate_limits
  WHERE key = _key
    AND created_at > now() - (_window_seconds || ' seconds')::interval;

  IF v_count >= _max THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limits (key) VALUES (_key);
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_record_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_record_rate_limit(text, int, int) TO service_role;
