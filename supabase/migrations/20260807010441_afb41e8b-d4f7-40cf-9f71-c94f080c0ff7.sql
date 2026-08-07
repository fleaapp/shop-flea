ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_hidden_at timestamptz;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS seller_hidden_at timestamptz;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS admin_removed_at timestamptz;

CREATE OR REPLACE FUNCTION public.seller_hide_sale(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order record;
BEGIN
  SELECT id, seller_id, status INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  IF v_order.seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_order.status NOT IN ('completed','refunded','cancelled') THEN
    RAISE EXCEPTION 'You can only remove a sale once it is completed, refunded or cancelled';
  END IF;
  UPDATE orders SET seller_hidden_at = now() WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_hide_sale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_hide_sale(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.seller_hide_sold_listing(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_listing record;
BEGIN
  SELECT id, user_id INTO v_listing FROM listings WHERE id = p_listing_id;
  IF v_listing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;
  IF v_listing.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM orders o
    WHERE o.listing_id = p_listing_id
      AND o.status NOT IN ('completed','refunded','cancelled')
  ) THEN
    RAISE EXCEPTION 'This item still has an active order, so it cannot be removed yet';
  END IF;
  UPDATE listings SET seller_hidden_at = now() WHERE id = p_listing_id;
  UPDATE orders SET seller_hidden_at = now() WHERE listing_id = p_listing_id AND seller_hidden_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_hide_sold_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_hide_sold_listing(uuid) TO authenticated;