-- Create discarded_listings table to track listings users have swiped left on
CREATE TABLE public.discarded_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

-- Enable RLS
ALTER TABLE public.discarded_listings ENABLE ROW LEVEL SECURITY;

-- Users can view their own discarded listings
CREATE POLICY "Users can view their own discarded listings"
ON public.discarded_listings
FOR SELECT
USING (auth.uid() = user_id);

-- Users can add discarded listings
CREATE POLICY "Users can add discarded listings"
ON public.discarded_listings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove discarded listings (for refresh functionality)
CREATE POLICY "Users can remove their discarded listings"
ON public.discarded_listings
FOR DELETE
USING (auth.uid() = user_id);