-- Hide email column from regular users; service role and the owner still have it via auth.users
REVOKE SELECT (email) ON public.profiles FROM anon, authenticated;

-- Speed up trending searches RPC
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON public.search_queries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_queries_query_created ON public.search_queries (query, created_at DESC);