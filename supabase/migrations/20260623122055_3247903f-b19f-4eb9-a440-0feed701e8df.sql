
-- Profiles: revoke client read on sensitive internal columns
REVOKE SELECT (legal_name, report_strike_count, gst_alert_60k_sent_at, gst_alert_75k_sent_at)
  ON public.profiles FROM authenticated;
REVOKE SELECT (legal_name, report_strike_count, gst_alert_60k_sent_at, gst_alert_75k_sent_at)
  ON public.profiles FROM anon;

-- Payment events: revoke client read on raw webhook payload (defense in depth)
REVOKE SELECT (payload) ON public.payment_events FROM authenticated;
REVOKE SELECT (payload) ON public.payment_events FROM anon;

-- Saved searches & rate_limits: ensure no client role can access; only service role
REVOKE ALL ON public.saved_searches FROM authenticated, anon;
GRANT ALL ON public.saved_searches TO service_role;

REVOKE ALL ON public.rate_limits FROM authenticated, anon;
GRANT ALL ON public.rate_limits TO service_role;
