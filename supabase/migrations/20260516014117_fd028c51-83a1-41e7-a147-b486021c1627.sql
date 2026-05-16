DROP INDEX IF EXISTS public.saved_searches_user_query_unique;

CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_user_signature_unique
  ON public.saved_searches (user_id, signature);