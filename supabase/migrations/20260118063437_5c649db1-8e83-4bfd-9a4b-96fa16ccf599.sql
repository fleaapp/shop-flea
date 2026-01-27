-- Create a table for listing comments
CREATE TABLE public.listing_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.listing_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for comment access
CREATE POLICY "Comments are viewable by everyone" 
ON public.listing_comments 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own comments" 
ON public.listing_comments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" 
ON public.listing_comments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
ON public.listing_comments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_listing_comments_updated_at
BEFORE UPDATE ON public.listing_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups by listing
CREATE INDEX idx_listing_comments_listing_id ON public.listing_comments(listing_id);
CREATE INDEX idx_listing_comments_user_id ON public.listing_comments(user_id);