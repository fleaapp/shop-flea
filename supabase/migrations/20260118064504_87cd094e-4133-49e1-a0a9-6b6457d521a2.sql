-- Add parent_id column for threaded replies
ALTER TABLE public.listing_comments 
ADD COLUMN parent_id uuid REFERENCES public.listing_comments(id) ON DELETE CASCADE;

-- Add index for faster reply lookups
CREATE INDEX idx_listing_comments_parent_id ON public.listing_comments(parent_id);