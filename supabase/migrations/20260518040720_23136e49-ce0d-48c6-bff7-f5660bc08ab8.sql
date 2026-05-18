CREATE TABLE public.contact_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  ip_address text,
  user_agent text,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact form"
ON public.contact_submissions
FOR INSERT
TO public
WITH CHECK (
  length(trim(name)) BETWEEN 1 AND 100
  AND length(trim(email)) BETWEEN 3 AND 255
  AND length(trim(message)) BETWEEN 1 AND 5000
);

CREATE POLICY "Service role can read contact submissions"
ON public.contact_submissions
FOR SELECT
TO public
USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update contact submissions"
ON public.contact_submissions
FOR UPDATE
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions (created_at DESC);