
CREATE OR REPLACE FUNCTION public.notify_on_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_listing_owner_id uuid;
  v_parent_comment_author_id uuid;
  v_commenter_username text;
  v_listing_title text;
BEGIN
  SELECT username INTO v_commenter_username
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  SELECT user_id, title INTO v_listing_owner_id, v_listing_title
  FROM public.listings
  WHERE id = NEW.listing_id;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_comment_author_id
    FROM public.listing_comments
    WHERE id = NEW.parent_id;

    IF v_parent_comment_author_id IS NOT NULL AND v_parent_comment_author_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
      VALUES (
        v_parent_comment_author_id,
        'comment_reply',
        'New Reply',
        COALESCE(v_commenter_username, '@user') || ' replied to your comment on "' || LEFT(v_listing_title, 30) || '".',
        NEW.listing_id,
        NEW.user_id
      );
    END IF;
  END IF;

  IF v_listing_owner_id IS NOT NULL AND v_listing_owner_id != NEW.user_id THEN
    IF NEW.parent_id IS NULL OR v_listing_owner_id != v_parent_comment_author_id THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
      VALUES (
        v_listing_owner_id,
        'new_comment',
        'New Comment',
        COALESCE(v_commenter_username, '@user') || ' commented on your listing "' || LEFT(v_listing_title, 30) || '".',
        NEW.listing_id,
        NEW.user_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
