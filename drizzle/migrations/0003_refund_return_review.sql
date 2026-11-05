ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_verified_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_verified_by uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_refund_failed_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_refund_error text;
CREATE INDEX IF NOT EXISTS orders_verified_return_retry_idx ON public.orders(return_verified_at) WHERE return_verified_at IS NOT NULL AND refunded_at IS NULL;
CREATE OR REPLACE FUNCTION public.admin_verify_return(p_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
UPDATE public.orders SET return_verified_at=now(),return_verified_by=auth.uid(),updated_at=now() WHERE id=p_order_id AND return_required_at IS NOT NULL AND return_delivered_at IS NOT NULL AND refunded_at IS NULL AND return_closed_at IS NULL;
IF NOT FOUND THEN RAISE EXCEPTION 'Return delivery must be confirmed before review'; END IF; END $$;
REVOKE ALL ON FUNCTION public.admin_verify_return(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_verify_return(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.admin_dismiss_refund_dispute(p_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
UPDATE public.orders SET refund_requested_at=NULL,refund_requested_by=NULL,refund_request_reason=NULL,refund_request_deadline_at=NULL,refund_declined_at=NULL,refund_declined_reason=NULL,refund_escalated_at=NULL,return_closed_at=CASE WHEN return_required_at IS NOT NULL THEN now() ELSE return_closed_at END,return_required_at=NULL,return_deadline_at=NULL,updated_at=now() WHERE id=p_order_id AND refunded_at IS NULL; END $$;
CREATE OR REPLACE FUNCTION public.submit_return_tracking(p_order_id uuid,p_provider text,p_number text) RETURNS SETOF public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Please submit return tracking through Flea so the carrier can be checked.'; END $$;
CREATE OR REPLACE FUNCTION public.escalate_stalled_returns() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_count integer; BEGIN
WITH updated AS (UPDATE public.orders SET refund_escalated_at=now(),updated_at=now() WHERE return_required_at IS NOT NULL AND return_delivered_at IS NULL AND return_closed_at IS NULL AND refunded_at IS NULL AND refund_escalated_at IS NULL AND COALESCE(return_posted_at,return_required_at)<now()-interval '21 days' RETURNING 1) SELECT count(*) INTO v_count FROM updated; RETURN v_count; END $$;
REVOKE ALL ON FUNCTION public.escalate_stalled_returns() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_stalled_returns() TO service_role;
CREATE OR REPLACE FUNCTION public.guard_unresolved_completion() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' AND (NEW.disputed_at IS NOT NULL OR NEW.refund_requested_at IS NOT NULL) AND NEW.refunded_at IS NULL THEN RAISE EXCEPTION 'An unresolved refund or dispute prevents completion.'; END IF; RETURN NEW; END $$;
CREATE TRIGGER orders_unresolved_completion BEFORE UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_unresolved_completion();