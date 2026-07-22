
-- =========================================================
-- Phase 1.1: Neutralise email queue firestorm
-- =========================================================

-- email_queue_wake: only arm cron when a real backlog exists.
-- Previously scheduled on every enqueue -> historical 876k invocations.
CREATE OR REPLACE FUNCTION public.email_queue_wake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_backlog int := 0;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);

  -- Cheap backlog probe. Only arm cron if enough messages are waiting to
  -- justify a recurring job; a single email is handled by the direct
  -- edge-function invoke from the enqueue path.
  BEGIN
    SELECT (SELECT count(*) FROM pgmq.q_auth_emails)
         + (SELECT count(*) FROM pgmq.q_transactional_emails)
      INTO v_backlog;
  EXCEPTION WHEN undefined_table THEN
    v_backlog := 0;
  END;

  IF v_backlog < 3 THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    BEGIN
      PERFORM cron.schedule(
        'process-email-queue',
        '2 minutes',
        $cron$ SELECT public.email_queue_dispatch(); $cron$
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_wake: cron schedule failed: %', SQLERRM;
    END;
  END IF;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_queue_wake failed (enqueue preserved): %', SQLERRM;
  RETURN NULL;
END;
$function$;

-- If the safety-net cron is currently scheduled at 60s, bump to 2 min.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    PERFORM cron.unschedule('process-email-queue');
    PERFORM cron.schedule(
      'process-email-queue',
      '2 minutes',
      $cron$ SELECT public.email_queue_dispatch(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'cron reschedule skipped: %', SQLERRM;
END $$;

-- =========================================================
-- Phase 1.2: Harden SECURITY DEFINER surface
-- Revoke public/anon/authenticated execute from internal helpers.
-- These are only called by triggers, cron, or edge functions.
-- =========================================================

REVOKE ALL ON FUNCTION public.delete_email(text, bigint)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, int, int)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch()              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake()                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_push_vault_key(text)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_profiles_public()               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_push_notification()         FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint)          TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)          TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, int, int)    TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch()              TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_push_vault_key(text)           TO service_role;
GRANT EXECUTE ON FUNCTION public.get_profiles_public()               TO service_role;
