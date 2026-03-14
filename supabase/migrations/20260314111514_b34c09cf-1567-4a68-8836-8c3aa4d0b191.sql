CREATE OR REPLACE FUNCTION public.get_trending_searches(limit_count integer DEFAULT 10)
RETURNS TABLE(query text, search_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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