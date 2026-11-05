DO $$ DECLARE d text; BEGIN
SELECT pg_get_functiondef('public.auto_complete_delivered_orders()'::regprocedure) INTO d; d:=replace(d,'(refund_requested_at IS NULL OR refund_declined_at IS NOT NULL)','refund_requested_at IS NULL AND disputed_at IS NULL AND refunded_at IS NULL'); EXECUTE d;
SELECT pg_get_functiondef('public.complete_order(uuid,uuid)'::regprocedure) INTO d;d:=replace(d,'o.refund_requested_at IS NOT NULL AND o.refund_declined_at IS NULL AND o.refunded_at IS NULL','o.refund_requested_at IS NOT NULL AND o.refunded_at IS NULL');EXECUTE d;
SELECT pg_get_functiondef('public.get_home_feed(integer,integer)'::regprocedure) INTO d;d:=replace(d,'AND l.user_id <> v_user_id','AND l.user_id <> v_user_id AND NOT public.users_blocked(v_user_id,l.user_id)');EXECUTE d;
END $$;