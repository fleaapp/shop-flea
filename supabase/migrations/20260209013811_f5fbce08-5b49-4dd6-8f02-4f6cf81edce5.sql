-- Allow authenticated users to insert notifications (for mentions, etc.)
CREATE POLICY "Users can create notifications for others"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create a function to create mention notifications
CREATE OR REPLACE FUNCTION public.create_mention_notifications(
  p_mentioned_usernames text[],
  p_mentioner_user_id uuid,
  p_listing_id uuid,
  p_comment_preview text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentioned_username text;
  mentioned_user_id uuid;
BEGIN
  FOREACH mentioned_username IN ARRAY p_mentioned_usernames
  LOOP
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
        COALESCE(LEFT(p_comment_preview, 100), 'Someone mentioned you in a comment'),
        p_listing_id,
        p_mentioner_user_id
      );
    END IF;
  END LOOP;
END;
$$;