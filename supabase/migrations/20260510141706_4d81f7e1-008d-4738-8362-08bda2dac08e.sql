
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gst_alert_60k_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS gst_alert_75k_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.check_seller_gst_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_60k_sent timestamptz;
  v_75k_sent timestamptz;
BEGIN
  -- Sum of seller's gross sales in last 12 months (excluding refunded)
  SELECT COALESCE(SUM(price + COALESCE(shipping_price, 0)), 0)
  INTO v_total
  FROM public.orders
  WHERE seller_id = NEW.seller_id
    AND status <> 'refunded'
    AND refunded_at IS NULL
    AND created_at > now() - interval '12 months';

  SELECT gst_alert_60k_sent_at, gst_alert_75k_sent_at
  INTO v_60k_sent, v_75k_sent
  FROM public.profiles
  WHERE user_id = NEW.seller_id;

  -- $75k AU GST registration threshold (mandatory)
  IF v_total >= 75000 AND v_75k_sent IS NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.seller_id,
      'gst_threshold_reached',
      'GST registration required',
      '⚠️ Your sales on Flea have passed AU$75,000 in the last 12 months. Australian law requires you to register for GST with the ATO. Tap to learn more.'
    );
    UPDATE public.profiles SET gst_alert_75k_sent_at = now() WHERE user_id = NEW.seller_id;

  -- $60k AU approaching threshold (heads-up)
  ELSIF v_total >= 60000 AND v_60k_sent IS NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.seller_id,
      'gst_threshold_approaching',
      'Approaching GST threshold',
      '📊 Your sales on Flea are approaching AU$75,000 in the last 12 months. Once you cross that, the ATO requires you to register for GST. Tap to learn more.'
    );
    UPDATE public.profiles SET gst_alert_60k_sent_at = now() WHERE user_id = NEW.seller_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'GST threshold check failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_seller_gst_threshold ON public.orders;
CREATE TRIGGER trg_check_seller_gst_threshold
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.check_seller_gst_threshold();
