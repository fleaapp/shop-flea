ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_status text,
  ADD COLUMN IF NOT EXISTS bank_last_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bank_change_count_30d integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_change_window_start timestamptz,
  ADD COLUMN IF NOT EXISTS payout_failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_failure_reason text,
  ADD COLUMN IF NOT EXISTS payout_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_review_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_review_reason text;

CREATE OR REPLACE FUNCTION public.protect_payout_risk_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.bank_status := OLD.bank_status;
  NEW.bank_last_changed_at := OLD.bank_last_changed_at;
  NEW.bank_change_count_30d := OLD.bank_change_count_30d;
  NEW.bank_change_window_start := OLD.bank_change_window_start;
  NEW.payout_failure_count := OLD.payout_failure_count;
  NEW.payout_failure_reason := OLD.payout_failure_reason;
  NEW.payout_failure_at := OLD.payout_failure_at;
  NEW.payout_review_flag := OLD.payout_review_flag;
  NEW.payout_review_reason := OLD.payout_review_reason;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_payout_risk_columns_trg ON public.profiles;
CREATE TRIGGER protect_payout_risk_columns_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_payout_risk_columns();