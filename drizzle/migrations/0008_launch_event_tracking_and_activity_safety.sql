CREATE TABLE public.webhook_claims (event_id text PRIMARY KEY, lease_id uuid NOT NULL, lease_until timestamptz NOT NULL, completed_at timestamptz);
GRANT ALL ON public.webhook_claims TO service_role;
ALTER TABLE public.webhook_claims ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_webhook(p_event_id text, p_lease_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed text;
BEGIN
 INSERT INTO public.webhook_claims(event_id,lease_id,lease_until) VALUES(p_event_id,p_lease_id,now()+interval '5 minutes') ON CONFLICT(event_id) DO UPDATE SET lease_id=excluded.lease_id,lease_until=excluded.lease_until WHERE webhook_claims.completed_at IS NULL AND webhook_claims.lease_until < now() RETURNING event_id INTO claimed;
 IF claimed IS NOT NULL THEN RETURN 'claimed'; END IF;
 IF EXISTS(SELECT 1 FROM public.webhook_claims WHERE event_id=p_event_id AND completed_at IS NOT NULL) THEN RETURN 'completed'; END IF;
 RETURN 'busy';
END $$;
REVOKE ALL ON FUNCTION public.claim_webhook(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_webhook(text,uuid) TO service_role;
ALTER TABLE public.notifications ADD COLUMN delivery_key text;
CREATE UNIQUE INDEX notifications_delivery_key_unique ON public.notifications(delivery_key) WHERE delivery_key IS NOT NULL;
CREATE TABLE public.shipping_validation (seller_id uuid NOT NULL, order_group_id uuid NOT NULL, tracking_number text NOT NULL, carrier_name text NOT NULL, verified_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(order_group_id,tracking_number));
GRANT ALL ON public.shipping_validation TO service_role;
ALTER TABLE public.shipping_validation ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.mark_order_shipped(p_order_id uuid DEFAULT NULL,p_order_group_id uuid DEFAULT NULL,p_tracking_provider text DEFAULT NULL,p_tracking_number text DEFAULT NULL) RETURNS SETOF public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target_group uuid; normal_number text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 IF (p_order_id IS NULL) = (p_order_group_id IS NULL) THEN RAISE EXCEPTION 'Provide exactly one order or group'; END IF;
 SELECT coalesce(o.order_group_id,o.id) INTO target_group FROM public.orders o WHERE o.seller_id=auth.uid() AND ((p_order_id IS NOT NULL AND o.id=p_order_id) OR (p_order_group_id IS NOT NULL AND o.order_group_id=p_order_group_id)) LIMIT 1;
 normal_number := upper(regexp_replace(coalesce(p_tracking_number,''),'[[:space:]-]+','','g'));
 IF target_group IS NULL OR NOT EXISTS(SELECT 1 FROM public.shipping_validation v WHERE v.seller_id=auth.uid() AND v.order_group_id=target_group AND v.tracking_number=normal_number AND v.carrier_name=p_tracking_provider AND v.verified_at>now()-interval '15 minutes') THEN RAISE EXCEPTION 'Tracking must be verified with the carrier before shipping.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(normal_number));
 IF EXISTS(SELECT 1 FROM public.orders o WHERE upper(regexp_replace(coalesce(o.tracking_number,''),'[[:space:]-]+','','g'))=normal_number AND coalesce(o.order_group_id,o.id)<>target_group) OR EXISTS(SELECT 1 FROM public.tracking_shipments s WHERE upper(regexp_replace(s.tracking_number,'[[:space:]-]+','','g'))=normal_number AND s.order_group_id<>target_group) THEN RAISE EXCEPTION 'This tracking number belongs to another order.'; END IF;
 RETURN QUERY UPDATE public.orders o SET status='shipped',tracking_provider=p_tracking_provider,tracking_number=normal_number,shipped_at=now(),updated_at=now() WHERE o.seller_id=auth.uid() AND o.status='awaiting' AND ((p_order_id IS NOT NULL AND o.id=p_order_id) OR (p_order_group_id IS NOT NULL AND o.order_group_id=p_order_group_id)) RETURNING o.*;
END $$;
CREATE VIEW public.seller_profiles WITH (security_barrier=true) AS SELECT id,user_id,username,avatar_url,location,country_code,region_id,rating,total_reviews,pause_selling,tiered_shipping_enabled,shipping_tier_1,shipping_tier_2,shipping_tier_3,bundle_shipping_mode,bundle_shipping_discount_percent,shipping_preferences_set,stripe_onboarding_complete,paypal_onboarding_complete,status,CASE WHEN last_sign_in_at < now()-interval '10 days' THEN now()-interval '11 days' WHEN last_sign_in_at IS NOT NULL THEN now() ELSE NULL END AS last_sign_in_at,date_trunc('day',created_at) AS created_at,date_trunc('day',updated_at) AS updated_at,offers_enabled,bundle_item_discount_percent FROM public.profiles_public;
GRANT SELECT ON public.seller_profiles TO anon,authenticated;
GRANT ALL ON public.seller_profiles TO service_role;
REVOKE SELECT ON public.profiles_public FROM anon,authenticated;
GRANT SELECT(id,user_id,username,avatar_url,location,country_code,region_id,rating,total_reviews,pause_selling,tiered_shipping_enabled,shipping_tier_1,shipping_tier_2,shipping_tier_3,bundle_shipping_mode,bundle_shipping_discount_percent,shipping_preferences_set,stripe_onboarding_complete,paypal_onboarding_complete,status,created_at,offers_enabled,bundle_item_discount_percent) ON public.profiles_public TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_profiles_public() RETURNS TABLE(id uuid,user_id uuid,username text,avatar_url text,location text,country_code text,region_id text,rating numeric,total_reviews integer,pause_selling boolean,tiered_shipping_enabled boolean,shipping_tier_1 numeric,shipping_tier_2 numeric,shipping_tier_3 numeric,bundle_shipping_mode text,bundle_shipping_discount_percent integer,shipping_preferences_set boolean,stripe_onboarding_complete boolean,paypal_onboarding_complete boolean,status text,last_sign_in_at timestamptz,created_at timestamptz,updated_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT s.id,s.user_id,s.username,s.avatar_url,s.location,s.country_code,s.region_id,s.rating,s.total_reviews,s.pause_selling,s.tiered_shipping_enabled,s.shipping_tier_1,s.shipping_tier_2,s.shipping_tier_3,s.bundle_shipping_mode,s.bundle_shipping_discount_percent,s.shipping_preferences_set,s.stripe_onboarding_complete,s.paypal_onboarding_complete,s.status,s.last_sign_in_at,s.created_at,s.updated_at FROM public.seller_profiles s $$;