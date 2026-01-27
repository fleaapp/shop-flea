-- Drop the old constraint and add a new one with all notification types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'like'::text, 
    'sale'::text, 
    'price_drop'::text, 
    'new_follower'::text, 
    'message'::text,
    'price_drop_cart'::text,
    'price_drop_wishlist'::text,
    'cart_item_sold'::text,
    'wishlist_item_sold'::text,
    'new_review'::text,
    'item_sold'::text,
    'order_shipped'::text,
    'order_delivered'::text
  ])
);