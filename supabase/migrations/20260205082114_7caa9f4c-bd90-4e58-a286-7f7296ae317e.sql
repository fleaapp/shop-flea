-- Create table to track search queries for trending searches
CREATE TABLE public.search_queries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query text NOT NULL,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient query counting
CREATE INDEX idx_search_queries_query ON public.search_queries(query);
CREATE INDEX idx_search_queries_created_at ON public.search_queries(created_at);

-- Enable RLS
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

-- Anyone can insert search queries (anonymous allowed for tracking)
CREATE POLICY "Anyone can insert search queries"
ON public.search_queries
FOR INSERT
WITH CHECK (true);

-- Only allow reading aggregated data through a function, not direct access
CREATE POLICY "Users can view their own search history"
ON public.search_queries
FOR SELECT
USING (auth.uid() = user_id);

-- Create function to get trending searches (last 7 days)
CREATE OR REPLACE FUNCTION public.get_trending_searches(limit_count integer DEFAULT 8)
RETURNS TABLE(query text, search_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sq.query,
    COUNT(*) as search_count
  FROM public.search_queries sq
  WHERE sq.created_at > now() - interval '7 days'
  GROUP BY sq.query
  ORDER BY search_count DESC
  LIMIT limit_count;
END;
$$;