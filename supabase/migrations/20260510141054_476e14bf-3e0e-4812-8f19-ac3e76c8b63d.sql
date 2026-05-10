-- 1) buyer_addresses table
CREATE TABLE IF NOT EXISTS public.buyer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  suburb text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  postcode text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buyer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own address"
  ON public.buyer_addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own address"
  ON public.buyer_addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own address"
  ON public.buyer_addresses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own address"
  ON public.buyer_addresses FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_buyer_addresses_updated_at
  BEFORE UPDATE ON public.buyer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) marketing opt-in flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT true;

-- 3) Reports anti-abuse: cap 20 per reporter per 24h
CREATE OR REPLACE FUNCTION public.enforce_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.reports
  WHERE reporting_user_id = NEW.reporting_user_id
    AND created_at > now() - interval '24 hours';
  IF v_count >= 20 THEN
    RAISE EXCEPTION 'Report rate limit reached. Please try again later.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_rate_limit ON public.reports;
CREATE TRIGGER trg_reports_rate_limit
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_rate_limit();