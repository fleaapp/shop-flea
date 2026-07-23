
-- 1. RPC that lets a thread owner mark all non-user support messages read.
CREATE OR REPLACE FUNCTION public.mark_support_thread_read(_thread_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_msg_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner FROM public.chat_threads WHERE id = _thread_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized for this thread';
  END IF;

  WITH updated AS (
    UPDATE public.chat_messages
    SET read = true
    WHERE thread_id = _thread_id
      AND sender_type <> 'user'
      AND read = false
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_msg_count FROM updated;

  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = v_owner
    AND related_thread_id = _thread_id
    AND type = 'support_message'
    AND COALESCE(is_read, false) = false;

  RETURN v_msg_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_support_thread_read(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_support_thread_read(uuid) FROM anon;

-- 2. Backfill: mark unread order messages read on refunded orders (unreachable in UI).
UPDATE public.order_messages om
SET read = true
FROM public.orders o
WHERE om.order_id = o.id
  AND o.status = 'refunded'
  AND om.read = false;
