-- Helper to seed / rotate the vault entry used by the push trigger.
-- Called once by an edge function that has SUPABASE_SERVICE_ROLE_KEY in env.
CREATE OR REPLACE FUNCTION public.seed_push_vault_key(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  IF p_key IS NULL OR length(p_key) < 20 THEN
    RAISE EXCEPTION 'invalid key';
  END IF;

  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = 'push_service_role_key';

  IF v_existing_id IS NULL THEN
    PERFORM vault.create_secret(p_key, 'push_service_role_key', 'Service role key used by trigger_push_notification to authorize send-push-notification calls');
  ELSE
    PERFORM vault.update_secret(v_existing_id, p_key);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_push_vault_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_push_vault_key(text) TO service_role;

-- Rewrite the trigger to read the auth token from the vault instead of a
-- (never-set) postgres GUC. Matches the working pattern used by
-- email_queue_dispatch / email_queue_wake.
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
  v_service_key text;
BEGIN
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'push_service_role_key'
  LIMIT 1;

  IF v_service_key IS NULL OR length(v_service_key) < 20 THEN
    RAISE WARNING 'trigger_push_notification: push_service_role_key not seeded in vault';
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'notification', jsonb_build_object(
      'type', NEW.type,
      'title', NEW.title,
      'message', NEW.message,
      'related_listing_id', NEW.related_listing_id,
      'related_order_id', NEW.related_order_id,
      'related_thread_id', NEW.related_thread_id
    )
  );

  PERFORM net.http_post(
    url := 'https://teaicrimlqdayqpmxasc.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Ensure the trigger is attached to notifications inserts (create if missing;
-- safe no-op if already present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'notifications_push_trigger'
      AND tgrelid = 'public.notifications'::regclass
  ) THEN
    CREATE TRIGGER notifications_push_trigger
      AFTER INSERT ON public.notifications
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_push_notification();
  END IF;
END $$;