-- Create reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  reviewed_user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Ensure only one review per order per reviewer
  UNIQUE(order_id, reviewer_id)
);

-- Enable Row Level Security
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Everyone can view reviews
CREATE POLICY "Reviews are viewable by everyone"
ON public.reviews
FOR SELECT
USING (true);

-- Only buyers and sellers of delivered orders can create reviews
CREATE POLICY "Users can create reviews for their delivered orders"
ON public.reviews
FOR INSERT
WITH CHECK (
  auth.uid() = reviewer_id
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
    AND o.status = 'delivered'
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    AND (
      (o.buyer_id = auth.uid() AND reviewed_user_id = o.seller_id)
      OR (o.seller_id = auth.uid() AND reviewed_user_id = o.buyer_id)
    )
  )
);

-- Users can update their own reviews
CREATE POLICY "Users can update their own reviews"
ON public.reviews
FOR UPDATE
USING (auth.uid() = reviewer_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete their own reviews"
ON public.reviews
FOR DELETE
USING (auth.uid() = reviewer_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update user rating when a review is added/updated/deleted
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_avg_rating numeric;
  v_total_reviews integer;
BEGIN
  -- Determine which user to update
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.reviewed_user_id;
  ELSE
    v_user_id := NEW.reviewed_user_id;
  END IF;
  
  -- Calculate new average rating
  SELECT 
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
    COUNT(*)
  INTO v_avg_rating, v_total_reviews
  FROM public.reviews
  WHERE reviewed_user_id = v_user_id;
  
  -- Update the user's profile
  UPDATE public.profiles
  SET 
    rating = v_avg_rating,
    total_reviews = v_total_reviews,
    updated_at = now()
  WHERE user_id = v_user_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers for rating updates
CREATE TRIGGER update_rating_on_review_insert
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_user_rating();

CREATE TRIGGER update_rating_on_review_update
AFTER UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_user_rating();

CREATE TRIGGER update_rating_on_review_delete
AFTER DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_user_rating();