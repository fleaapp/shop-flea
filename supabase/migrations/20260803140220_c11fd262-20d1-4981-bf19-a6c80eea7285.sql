
-- Signed-in only actions
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'admin_approve_tracking(uuid)',
    'admin_approve_untracked_delivery(uuid)',
    'admin_dismiss_refund_dispute(uuid)',
    'admin_reject_tracking(uuid, text)',
    'admin_reject_untracked_delivery(uuid, text)',
    'complete_order(uuid, uuid)',
    'mark_order_delivered(uuid, uuid, text)',
    'mark_order_shipped(uuid, uuid, text, text)',
    'respond_to_refund_request(uuid, uuid, text, text)',
    'get_nav_badges(uuid)',
    'create_mention_notifications(text[], uuid, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- Internal automation / trigger-only functions: no API access at all
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'auto_complete_delivered_orders()',
    'auto_deliver_shipped_orders()',
    'check_seller_gst_threshold()',
    'cleanup_removed_listing()',
    'cleanup_user_listings_on_profile_change()',
    'close_offers_when_disabled()',
    'enforce_report_rate_limit()',
    'generate_order_number()',
    'handle_new_user()',
    'mark_listing_as_sold()',
    'notify_on_comment()',
    'notify_on_order_message()',
    'notify_on_order_status_change()',
    'notify_on_review()',
    'notify_on_support_message()',
    'notify_users_on_listing_sold()',
    'process_report()',
    'set_waitlist_region()',
    'update_last_sign_in()',
    'update_user_rating()',
    'void_offers_on_listing_change()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;
