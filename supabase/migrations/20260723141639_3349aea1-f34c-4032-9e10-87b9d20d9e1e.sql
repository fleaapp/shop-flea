CREATE TABLE public.admin_last_seen (
  user_id uuid NOT NULL,
  tab text NOT NULL CHECK (tab IN ('support', 'reports', 'bans', 'suggestions', 'waitlist', 'contact', 'transactions', 'refunds', 'listings', 'users', 'brands', 'error_logs')),
  seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tab)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_last_seen TO authenticated;
GRANT ALL ON public.admin_last_seen TO service_role;

ALTER TABLE public.admin_last_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their own seen timestamps"
ON public.admin_last_seen
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create their own seen timestamps"
ON public.admin_last_seen
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update their own seen timestamps"
ON public.admin_last_seen
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete their own seen timestamps"
ON public.admin_last_seen
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_admin_last_seen_updated_at
BEFORE UPDATE ON public.admin_last_seen
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();