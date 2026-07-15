GRANT SELECT ON public.brands TO anon;
GRANT SELECT, INSERT, UPDATE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;