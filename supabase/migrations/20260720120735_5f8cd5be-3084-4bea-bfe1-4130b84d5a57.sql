-- Phase 1: add missing objects to Cloud so schema is complete before data migration
-- Safe additive migration; nothing existing is dropped or modified.

-- 1. app_role enum + user_roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- has_role (SECURITY DEFINER to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. banned_users
CREATE TABLE IF NOT EXISTS public.banned_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  related_report_id uuid REFERENCES public.reports(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','lifted')),
  banned_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  banned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.banned_users TO authenticated;
GRANT ALL ON public.banned_users TO service_role;
ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view banned users" ON public.banned_users;
CREATE POLICY "Admins can view banned users" ON public.banned_users
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can check own ban status" ON public.banned_users;
CREATE POLICY "Users can check own ban status" ON public.banned_users
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can ban users" ON public.banned_users;
CREATE POLICY "Admins can ban users" ON public.banned_users
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update bans" ON public.banned_users;
CREATE POLICY "Admins can update bans" ON public.banned_users
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_banned_users_updated_at ON public.banned_users;
CREATE TRIGGER update_banned_users_updated_at
  BEFORE UPDATE ON public.banned_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. error_logs (admin-read; service_role writes via edge function)
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  user_id uuid,
  username text,
  title text NOT NULL,
  message text NOT NULL,
  stack text,
  route text,
  device jsonb,
  context jsonb,
  dedupe_key text
);
CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_source_idx ON public.error_logs(source);
CREATE INDEX IF NOT EXISTS error_logs_dedupe_recent_idx ON public.error_logs(dedupe_key, created_at DESC) WHERE dedupe_key IS NOT NULL;

GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read error logs" ON public.error_logs;
CREATE POLICY "Admins can read error logs" ON public.error_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. suggestions
CREATE TABLE IF NOT EXISTS public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read boolean NOT NULL DEFAULT false
);

GRANT SELECT, INSERT ON public.suggestions TO authenticated;
GRANT ALL ON public.suggestions TO service_role;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit suggestions" ON public.suggestions;
CREATE POLICY "Users can submit suggestions" ON public.suggestions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own suggestions" ON public.suggestions;
CREATE POLICY "Users can view their own suggestions" ON public.suggestions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all suggestions" ON public.suggestions;
CREATE POLICY "Admins can view all suggestions" ON public.suggestions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. cleanup_removed_listing trigger (fires when admin marks a listing 'removed')
CREATE OR REPLACE FUNCTION public.cleanup_removed_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order record;
BEGIN
  IF NEW.status = 'removed' AND (OLD.status IS DISTINCT FROM 'removed') THEN
    FOR v_order IN SELECT id, buyer_id, seller_id, listing_id, status FROM orders WHERE listing_id = NEW.id LOOP
      IF v_order.status IN ('awaiting','shipped') THEN
        INSERT INTO notifications (user_id, type, title, message, related_listing_id, related_user_id)
        VALUES (
          v_order.buyer_id, 'order_refunded', 'Order Cancelled',
          'Your order was cancelled because the listing was removed by Flea admin. The amount will be returned to your original payment method.',
          v_order.listing_id, v_order.seller_id
        );
        INSERT INTO notifications (user_id, type, title, message, related_listing_id, related_user_id)
        VALUES (
          v_order.seller_id, 'order_refunded', 'Order Removed',
          'An order was removed because your listing was deleted by Flea admin.',
          v_order.listing_id, v_order.buyer_id
        );
      END IF;
    END LOOP;

    DELETE FROM orders WHERE listing_id = NEW.id;
    DELETE FROM cart_items WHERE listing_id = NEW.id;
    DELETE FROM favorites WHERE listing_id = NEW.id;
    DELETE FROM discarded_listings WHERE listing_id = NEW.id;
    DELETE FROM listing_comments WHERE listing_id = NEW.id;
    DELETE FROM notifications WHERE related_listing_id = NEW.id AND type NOT IN ('order_refunded');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_removed_listing ON public.listings;
CREATE TRIGGER trg_cleanup_removed_listing
  AFTER UPDATE OF status ON public.listings
  FOR EACH ROW WHEN (NEW.status = 'removed')
  EXECUTE FUNCTION public.cleanup_removed_listing();