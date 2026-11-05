REVOKE ALL ON public.checkout_quotes FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.checkout_quotes TO service_role;
REVOKE UPDATE ON public.user_blocks FROM anon,authenticated;
REVOKE ALL ON public.user_blocks FROM anon;
CREATE OR REPLACE FUNCTION public.protect_return_review() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF auth.role()='authenticated' AND NOT public.has_role(auth.uid(),'admin') AND (NEW.return_verified_at IS DISTINCT FROM OLD.return_verified_at OR NEW.return_verified_by IS DISTINCT FROM OLD.return_verified_by) THEN RAISE EXCEPTION 'Only Flea may verify returns.'; END IF; RETURN NEW; END $$;
CREATE TRIGGER orders_protect_return_review BEFORE UPDATE OF return_verified_at,return_verified_by ON public.orders FOR EACH ROW EXECUTE FUNCTION public.protect_return_review();