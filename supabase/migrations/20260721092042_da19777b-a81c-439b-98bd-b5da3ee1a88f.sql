
CREATE OR REPLACE FUNCTION public.notify_on_order_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_sender_username text;
  v_clean_username text;
  v_listing_title text;
  v_recipient_id uuid;
  v_notif_type text;
  v_notif_message text;
BEGIN
  SELECT buyer_id, seller_id, listing_id INTO v_order
  FROM public.orders WHERE id = NEW.order_id;

  IF v_order IS NULL THEN RETURN NEW; END IF;

  SELECT username INTO v_sender_username
  FROM public.profiles WHERE user_id = NEW.sender_id;

  SELECT title INTO v_listing_title
  FROM public.listings WHERE id = v_order.listing_id;

  IF NEW.sender_id = v_order.seller_id THEN
    v_recipient_id := v_order.buyer_id;
    v_notif_type := 'order_message_seller';
    v_clean_username := regexp_replace(COALESCE(v_sender_username, 'seller'), '^@+', '');
    v_notif_message := '💬 New message from @' || v_clean_username || ' about your order! Tap to view.';
  ELSIF NEW.sender_id = v_order.buyer_id THEN
    v_recipient_id := v_order.seller_id;
    v_notif_type := 'order_message_buyer';
    v_clean_username := regexp_replace(COALESCE(v_sender_username, 'buyer'), '^@+', '');
    v_notif_message := '📩 New message from your buyer @' || v_clean_username || '! Tap to view.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id, related_order_id)
  VALUES (
    v_recipient_id,
    v_notif_type,
    'New Message',
    v_notif_message,
    v_order.listing_id,
    NEW.sender_id,
    NEW.order_id
  );

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Order participants can read order attachments" ON storage.objects;

CREATE POLICY "Order participants can read order attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = split_part(storage.objects.name, '/', 2)
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);
