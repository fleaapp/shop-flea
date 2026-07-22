-- ============================================================
-- 1. Email queue reliability: stop the 5-second cron firestorm
-- ============================================================

-- Replace email_queue_wake so it:
--   * only schedules a 60-second safety-net cron (no immediate edge-function call)
--   * avoids re-scheduling if the cron already exists
--   * still runs inside the enqueue transaction and cannot roll back the enqueue
CREATE OR REPLACE FUNCTION public.email_queue_wake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
BEGIN
  -- Serialize arming/disarming against email_queue_dispatch.
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);

  -- Only arm the safety-net cron if it is not already running.
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    BEGIN
      PERFORM cron.schedule(
        'process-email-queue',
        '60 seconds',
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
$fn$;

-- Replace email_queue_dispatch so it:
--   * takes the serialization lock for the whole body (prevents concurrent runs)
--   * returns immediately when both queues are empty and unschedules the cron
--   * only invokes the edge worker when there is real work to do
CREATE OR REPLACE FUNCTION public.email_queue_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
BEGIN
  -- Serialize the entire dispatch so only one cron tick can run at a time.
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);

  -- If both queues are empty, disarm the cron and exit without any HTTP call.
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
     AND NOT EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
    BEGIN
      PERFORM cron.unschedule('process-email-queue');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_dispatch: cron unschedule failed: %', SQLERRM;
    END;
    RETURN;
  END IF;

  -- Respect rate-limit cooldown.
  IF (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now() THEN
    RETURN;
  END IF;

  -- There is work to do; invoke the queue worker edge function.
  PERFORM net.http_post(
    url := 'https://teaicrimlqdayqpmxasc.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$fn$;

-- ============================================================
-- 2. Close security gaps on internal queue/helper functions
-- ============================================================

-- Add explicit search_path to the four queue RPC wrappers that currently
-- rely on the mutable default search_path.
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$fn$;

-- Revoke anonymous execution on internal/trigger functions that should never
-- be called directly by unauthenticated clients.
REVOKE EXECUTE ON FUNCTION public.check_seller_gst_threshold() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_removed_listing() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_user_listings_on_profile_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_mention_notifications(text[], uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_report_rate_limit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_nav_badges(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_seller_payment_accounts(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_brand_usage(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_listing_as_sold() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_order_delivered(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_order_shipped(uuid, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_order_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_order_status_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_review() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_support_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_users_on_listing_sold() FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_report() FROM anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_push_vault_key(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_push_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_last_sign_in() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_user_rating() FROM anon;

-- ============================================================
-- 3. Add critical indexes for the hottest query paths
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_listings_status_created_at
  ON public.listings (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_user_status_created
  ON public.listings (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_status
  ON public.orders (buyer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_seller_status
  ON public.orders (seller_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_messages_order_created
  ON public.order_messages (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_created
  ON public.cart_items (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_favorites_user_listing
  ON public.favorites (user_id, listing_id);
