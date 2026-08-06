-- 1. complete_order: buyers may only complete DELIVERED orders. Admins retain override.
CREATE OR REPLACE FUNCTION public.complete_order(p_order_id uuid DEFAULT NULL, p_order_group_id uuid DEFAULT NULL)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_order_id IS NULL AND p_order_group_id IS NULL THEN
    RAISE EXCEPTION 'order_id or order_group_id required';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET status = 'completed',
      completed_at = now(),
      delivered_at = COALESCE(o.delivered_at, now()),
      updated_at = now()
  WHERE (
      o.status = 'delivered'
      OR (v_is_admin AND o.status IN ('delivered', 'shipped'))
    )
    AND (o.buyer_id = auth.uid() OR v_is_admin)
    AND (
      (p_order_id IS NOT NULL AND o.id = p_order_id)
      OR (p_order_group_id IS NOT NULL AND o.order_group_id = p_order_group_id)
    )
  RETURNING o.*;
END;
$$;

-- 2. Revoke EXECUTE on internal-only routines from app roles.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'enqueue_email','delete_email','read_email_batch','email_queue_dispatch',
        'move_to_dlq','seed_push_vault_key','increment_coupon_redemption',
        'check_and_record_rate_limit','expire_stale_offers',
        'auto_complete_delivered_orders','auto_deliver_shipped_orders',
        'notify_expiring_accepted_offers','notify_offers_voided',
        'create_mention_notifications'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- 3. Apple review demo seller account.
UPDATE public.profiles
SET stripe_account_id = COALESCE(stripe_account_id, 'acct_demo_applereview'),
    stripe_onboarding_complete = true,
    updated_at = now()
WHERE username ILIKE 'applereview';
