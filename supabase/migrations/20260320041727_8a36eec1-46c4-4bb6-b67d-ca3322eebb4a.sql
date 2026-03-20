CREATE OR REPLACE FUNCTION public.create_mention_notifications(p_mentioned_usernames text[], p_mentioner_user_id uuid, p_listing_id uuid, p_comment_preview text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  mentioned_username text;
  mentioned_user_id uuid;
  clean_username text;
BEGIN
  IF array_length(p_mentioned_usernames, 1) IS NULL OR array_length(p_mentioned_usernames, 1) > 10 THEN
    IF array_length(p_mentioned_usernames, 1) > 10 THEN
      RAISE EXCEPTION 'Too many mentions (max 10)';
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.listings WHERE id = p_listing_id) THEN
    RETURN;
  END IF;

  p_comment_preview := LEFT(COALESCE(p_comment_preview, ''), 100);

  FOREACH mentioned_username IN ARRAY p_mentioned_usernames
  LOOP
    IF length(mentioned_username) > 50 THEN
      CONTINUE;
    END IF;

    -- Strip leading @ if present
    clean_username := ltrim(mentioned_username, '@');

    -- Look up by exact match, with @ prefix, or without
    SELECT user_id INTO mentioned_user_id
    FROM profiles
    WHERE username = mentioned_username
       OR username = '@' || clean_username
       OR username = clean_username
    LIMIT 1;
    
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != p_mentioner_user_id THEN
      INSERT INTO notifications (user_id, type, title, message, related_listing_id, related_user_id)
      VALUES (
        mentioned_user_id,
        'mention',
        'You were mentioned in a comment',
        COALESCE(p_comment_preview, 'Someone mentioned you in a comment'),
        p_listing_id,
        p_mentioner_user_id
      );
    END IF;
  END LOOP;
END;
$$;