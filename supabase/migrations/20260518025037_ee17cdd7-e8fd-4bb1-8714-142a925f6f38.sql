
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_lower_unique
  ON public.waitlist (lower(email));
