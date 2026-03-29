
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
  v_payload jsonb;
BEGIN
  -- Build payload
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

  -- Get Supabase URL and service role key from vault or env
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  -- Call the edge function via pg_net
  PERFORM net.http_post(
    url := COALESCE(v_supabase_url, 'https://teaicrimlqdayqpmxasc.supabase.co') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_key, current_setting('supabase.service_role_key', true))
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Don't block notification inserts if push fails
    RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_notification_insert_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();
