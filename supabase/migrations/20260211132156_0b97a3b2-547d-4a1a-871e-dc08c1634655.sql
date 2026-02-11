
-- 1. Harden get_email_by_username RPC with input validation
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  -- Input validation: reject empty or excessively long usernames
  IF p_username IS NULL OR length(trim(p_username)) < 1 OR length(p_username) > 50 THEN
    RETURN NULL;
  END IF;

  -- Sanitize input
  p_username := trim(p_username);

  -- Find user_id from profiles
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE username = p_username;
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get email from auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;
  
  RETURN v_email;
END;
$function$;

-- 2. Harden create_mention_notifications RPC with input validation
CREATE OR REPLACE FUNCTION public.create_mention_notifications(p_mentioned_usernames text[], p_mentioner_user_id uuid, p_listing_id uuid, p_comment_preview text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  mentioned_username text;
  mentioned_user_id uuid;
BEGIN
  -- Input validation: limit array size to prevent spam
  IF array_length(p_mentioned_usernames, 1) IS NULL OR array_length(p_mentioned_usernames, 1) > 10 THEN
    IF array_length(p_mentioned_usernames, 1) > 10 THEN
      RAISE EXCEPTION 'Too many mentions (max 10)';
    END IF;
    RETURN;
  END IF;

  -- Validate listing exists
  IF NOT EXISTS (SELECT 1 FROM public.listings WHERE id = p_listing_id) THEN
    RETURN;
  END IF;

  -- Truncate comment preview
  p_comment_preview := LEFT(COALESCE(p_comment_preview, ''), 100);

  FOREACH mentioned_username IN ARRAY p_mentioned_usernames
  LOOP
    -- Skip excessively long usernames
    IF length(mentioned_username) > 50 THEN
      CONTINUE;
    END IF;

    -- Find the user_id for this username
    SELECT user_id INTO mentioned_user_id
    FROM profiles
    WHERE username = mentioned_username
    LIMIT 1;
    
    -- Only create notification if user exists and is not the mentioner
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
$function$;

-- 3. Tighten storage upload policy to enforce user folder structure
DROP POLICY IF EXISTS "Authenticated users can upload listing images" ON storage.objects;

CREATE POLICY "Authenticated users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'listings' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
