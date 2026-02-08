-- Add moderation fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS report_strike_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add report_count to listings
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0;

-- Add report_count to listing_comments
ALTER TABLE public.listing_comments 
ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0;

-- Create reports table
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL CHECK (report_type IN ('user', 'listing', 'comment')),
  reported_entity_id uuid NOT NULL,
  reported_user_id uuid NOT NULL,
  reporting_user_id uuid NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate reports from same user
CREATE UNIQUE INDEX reports_unique_idx ON public.reports (report_type, reported_entity_id, reporting_user_id);

-- Enable RLS on reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "Users can create reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporting_user_id AND auth.uid() != reported_user_id);

-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
ON public.reports
FOR SELECT
TO authenticated
USING (auth.uid() = reporting_user_id);

-- Function to handle report submission and auto-enforcement
CREATE OR REPLACE FUNCTION public.process_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_count integer;
  v_listing_owner_id uuid;
  v_comment_author_id uuid;
  v_user_strike_count integer;
BEGIN
  -- Handle listing reports
  IF NEW.report_type = 'listing' THEN
    -- Increment listing report count
    UPDATE public.listings 
    SET report_count = report_count + 1 
    WHERE id = NEW.reported_entity_id
    RETURNING report_count INTO v_report_count;
    
    -- If listing has more than 2 reports, remove it and add strike to owner
    IF v_report_count > 2 THEN
      -- Get listing owner
      SELECT user_id INTO v_listing_owner_id 
      FROM public.listings 
      WHERE id = NEW.reported_entity_id;
      
      -- Remove listing (set status to removed)
      UPDATE public.listings 
      SET status = 'removed' 
      WHERE id = NEW.reported_entity_id;
      
      -- Add strike to owner
      UPDATE public.profiles 
      SET report_strike_count = report_strike_count + 1 
      WHERE user_id = v_listing_owner_id
      RETURNING report_strike_count INTO v_user_strike_count;
      
      -- Block user if more than 2 strikes
      IF v_user_strike_count > 2 THEN
        UPDATE public.profiles 
        SET status = 'blocked' 
        WHERE user_id = v_listing_owner_id;
      END IF;
      
      -- Notify listing owner
      INSERT INTO public.notifications (user_id, type, title, message, related_listing_id)
      VALUES (
        v_listing_owner_id,
        'listing_removed',
        'Listing Removed',
        'Your listing was removed after multiple reports. Continued violations may result in account restrictions.',
        NEW.reported_entity_id
      );
    END IF;
  
  -- Handle comment reports
  ELSIF NEW.report_type = 'comment' THEN
    -- Increment comment report count
    UPDATE public.listing_comments 
    SET report_count = report_count + 1 
    WHERE id = NEW.reported_entity_id
    RETURNING report_count, user_id INTO v_report_count, v_comment_author_id;
    
    -- If comment has more than 2 reports, remove it
    IF v_report_count > 2 THEN
      -- Delete the comment
      DELETE FROM public.listing_comments 
      WHERE id = NEW.reported_entity_id;
      
      -- Notify comment author
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        v_comment_author_id,
        'comment_removed',
        'Comment Removed',
        'Your comment was removed after multiple reports for violating Flea''s guidelines.'
      );
    END IF;
  
  -- Handle user reports
  ELSIF NEW.report_type = 'user' THEN
    -- Add strike to reported user
    UPDATE public.profiles 
    SET report_strike_count = report_strike_count + 1 
    WHERE user_id = NEW.reported_user_id
    RETURNING report_strike_count INTO v_user_strike_count;
    
    -- Block user if more than 2 strikes
    IF v_user_strike_count > 2 THEN
      UPDATE public.profiles 
      SET status = 'blocked' 
      WHERE user_id = NEW.reported_user_id;
      
      -- Notify blocked user
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        NEW.reported_user_id,
        'account_blocked',
        'Account Restricted',
        'Your account has been temporarily restricted due to repeated guideline violations. If you believe this is a mistake, contact support.'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for report processing
DROP TRIGGER IF EXISTS on_report_created ON public.reports;
CREATE TRIGGER on_report_created
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.process_report();

-- Function to check if user is blocked
CREATE OR REPLACE FUNCTION public.is_user_blocked(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'blocked' FROM public.profiles WHERE user_id = user_uuid),
    false
  )
$$;