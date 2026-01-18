-- Create function to notify on new comments and replies
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_listing_owner_id uuid;
  v_parent_comment_author_id uuid;
  v_commenter_username text;
  v_listing_title text;
BEGIN
  -- Get the commenter's username
  SELECT username INTO v_commenter_username
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Get the listing owner and title
  SELECT user_id, title INTO v_listing_owner_id, v_listing_title
  FROM public.listings
  WHERE id = NEW.listing_id;

  -- If this is a reply (has parent_id), notify the parent comment author
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_comment_author_id
    FROM public.listing_comments
    WHERE id = NEW.parent_id;

    -- Don't notify if replying to own comment
    IF v_parent_comment_author_id IS NOT NULL AND v_parent_comment_author_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
      VALUES (
        v_parent_comment_author_id,
        'comment_reply',
        'New Reply',
        COALESCE(v_commenter_username, '@user') || ' replied to your comment on "' || LEFT(v_listing_title, 30) || '"',
        NEW.listing_id,
        NEW.user_id
      );
    END IF;
  END IF;

  -- Notify the listing owner about any new comment (not their own)
  IF v_listing_owner_id IS NOT NULL AND v_listing_owner_id != NEW.user_id THEN
    -- Don't double-notify if the listing owner is also the parent comment author
    IF NEW.parent_id IS NULL OR v_listing_owner_id != v_parent_comment_author_id THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_listing_id, related_user_id)
      VALUES (
        v_listing_owner_id,
        'new_comment',
        'New Comment',
        COALESCE(v_commenter_username, '@user') || ' commented on your listing "' || LEFT(v_listing_title, 30) || '"',
        NEW.listing_id,
        NEW.user_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to fire on new comments
DROP TRIGGER IF EXISTS on_comment_created ON public.listing_comments;
CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.listing_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_comment();