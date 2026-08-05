CREATE OR REPLACE FUNCTION public.sync_profiles_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.profiles_public WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;

  INSERT INTO public.profiles_public (
    id, user_id, username, avatar_url, location, country_code, region_id,
    rating, total_reviews, pause_selling,
    tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3,
    bundle_shipping_mode, bundle_shipping_discount_percent, bundle_item_discount_percent,
    shipping_preferences_set,
    stripe_onboarding_complete, paypal_onboarding_complete,
    status, last_sign_in_at, created_at, updated_at, offers_enabled
  )
  VALUES (
    NEW.id, NEW.user_id, NEW.username, NEW.avatar_url, NEW.location, NEW.country_code, NEW.region_id,
    NEW.rating, NEW.total_reviews, NEW.pause_selling,
    NEW.tiered_shipping_enabled, NEW.shipping_tier_1, NEW.shipping_tier_2, NEW.shipping_tier_3,
    NEW.bundle_shipping_mode, NEW.bundle_shipping_discount_percent, NEW.bundle_item_discount_percent,
    NEW.shipping_preferences_set,
    NEW.stripe_onboarding_complete, NEW.paypal_onboarding_complete,
    NEW.status, NEW.last_sign_in_at, NEW.created_at, NEW.updated_at, NEW.offers_enabled
  )
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    location = EXCLUDED.location,
    country_code = EXCLUDED.country_code,
    region_id = EXCLUDED.region_id,
    rating = EXCLUDED.rating,
    total_reviews = EXCLUDED.total_reviews,
    pause_selling = EXCLUDED.pause_selling,
    tiered_shipping_enabled = EXCLUDED.tiered_shipping_enabled,
    shipping_tier_1 = EXCLUDED.shipping_tier_1,
    shipping_tier_2 = EXCLUDED.shipping_tier_2,
    shipping_tier_3 = EXCLUDED.shipping_tier_3,
    bundle_shipping_mode = EXCLUDED.bundle_shipping_mode,
    bundle_shipping_discount_percent = EXCLUDED.bundle_shipping_discount_percent,
    bundle_item_discount_percent = EXCLUDED.bundle_item_discount_percent,
    shipping_preferences_set = EXCLUDED.shipping_preferences_set,
    stripe_onboarding_complete = EXCLUDED.stripe_onboarding_complete,
    paypal_onboarding_complete = EXCLUDED.paypal_onboarding_complete,
    status = EXCLUDED.status,
    last_sign_in_at = EXCLUDED.last_sign_in_at,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    offers_enabled = EXCLUDED.offers_enabled;

  RETURN NEW;
END;
$function$;

DO $$
DECLARE test_users uuid[];
BEGIN
  SELECT array_agg(user_id) INTO test_users FROM public.profiles WHERE email LIKE '%fleatest.dev';
  IF test_users IS NULL THEN RETURN; END IF;

  DELETE FROM public.reviews WHERE order_id IN (SELECT id FROM public.orders WHERE checkout_reference LIKE 'smoke_%');
  DELETE FROM public.order_messages WHERE order_id IN (SELECT id FROM public.orders WHERE checkout_reference LIKE 'smoke_%');
  DELETE FROM public.orders WHERE checkout_reference LIKE 'smoke_%';
  DELETE FROM public.offers WHERE seller_id = ANY(test_users) OR buyer_id = ANY(test_users);
  DELETE FROM public.listing_comments WHERE user_id = ANY(test_users) OR listing_id IN (SELECT id FROM public.listings WHERE user_id = ANY(test_users));
  DELETE FROM public.favorites WHERE user_id = ANY(test_users) OR listing_id IN (SELECT id FROM public.listings WHERE user_id = ANY(test_users));
  DELETE FROM public.cart_items WHERE user_id = ANY(test_users) OR listing_id IN (SELECT id FROM public.listings WHERE user_id = ANY(test_users));
  DELETE FROM public.discarded_listings WHERE user_id = ANY(test_users);
  DELETE FROM public.reports WHERE reported_user_id = ANY(test_users) OR reporting_user_id = ANY(test_users);
  DELETE FROM public.listings WHERE user_id = ANY(test_users);
  DELETE FROM public.chat_messages WHERE thread_id IN (SELECT id FROM public.chat_threads WHERE user_id = ANY(test_users));
  DELETE FROM public.chat_threads WHERE user_id = ANY(test_users);
  DELETE FROM public.notifications WHERE user_id = ANY(test_users) OR related_user_id = ANY(test_users);
  DELETE FROM public.search_queries WHERE user_id = ANY(test_users);
  DELETE FROM public.buyer_addresses WHERE user_id = ANY(test_users);
  DELETE FROM public.push_subscriptions WHERE user_id = ANY(test_users);
  DELETE FROM public.profiles WHERE user_id = ANY(test_users);
  DELETE FROM public.profiles_public WHERE user_id = ANY(test_users);
END $$;