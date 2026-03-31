
-- Attach all notification-related triggers

-- 1. Push notification on every new notification insert
CREATE TRIGGER trg_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();

-- 2. Comment/reply notifications
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.listing_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_comment();

-- 3. Review notifications + rating update
CREATE TRIGGER trg_notify_on_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_review();

CREATE TRIGGER trg_update_user_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_rating();

-- 4. Order status change notifications (shipped/delivered)
CREATE TRIGGER trg_notify_on_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_order_status_change();

-- 5. Order message notifications
CREATE TRIGGER trg_notify_on_order_message
  AFTER INSERT ON public.order_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_order_message();

-- 6. Support message notifications
CREATE TRIGGER trg_notify_on_support_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_support_message();

-- 7. Item sold notifications (seller + cart/wishlist users)
CREATE TRIGGER trg_notify_users_on_listing_sold
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_users_on_listing_sold();

-- 8. Mark listing as sold when order created
CREATE TRIGGER trg_mark_listing_as_sold
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_listing_as_sold();

-- 9. Generate order number
CREATE TRIGGER trg_generate_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();

-- 10. Process reports
CREATE TRIGGER trg_process_report
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.process_report();

-- 11. Cleanup listings on profile block/delete
CREATE TRIGGER trg_cleanup_user_listings
  AFTER UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_user_listings_on_profile_change();

-- 12. Waitlist region auto-set
CREATE TRIGGER trg_set_waitlist_region
  BEFORE INSERT ON public.waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.set_waitlist_region();

-- 13. Updated_at triggers
CREATE TRIGGER trg_update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
