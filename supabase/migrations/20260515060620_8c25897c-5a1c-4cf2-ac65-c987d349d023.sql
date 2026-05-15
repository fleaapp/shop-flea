CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  query TEXT NOT NULL DEFAULT '',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  region_id TEXT,
  last_notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS signature TEXT;

UPDATE public.saved_searches
SET signature = md5(lower(trim(COALESCE(query, ''))) || '|' || COALESCE(filters::text, '{}') || '|' || COALESCE(region_id, ''))
WHERE signature IS NULL;

ALTER TABLE public.saved_searches
  ALTER COLUMN query SET DEFAULT '',
  ALTER COLUMN filters SET DEFAULT '{}'::jsonb,
  ALTER COLUMN signature SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_user_signature_unique
  ON public.saved_searches (user_id, signature);

CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx
  ON public.saved_searches (user_id);

CREATE INDEX IF NOT EXISTS saved_searches_region_idx
  ON public.saved_searches (region_id);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their saved searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users insert their saved searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users update their saved searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users delete their saved searches" ON public.saved_searches;

DROP TRIGGER IF EXISTS update_saved_searches_updated_at ON public.saved_searches;
CREATE TRIGGER update_saved_searches_updated_at
BEFORE UPDATE ON public.saved_searches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';