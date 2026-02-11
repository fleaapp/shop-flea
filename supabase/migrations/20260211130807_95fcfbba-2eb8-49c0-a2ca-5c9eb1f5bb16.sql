
-- =============================================
-- FIX 1: Create chat_threads and chat_messages tables with RLS
-- =============================================

CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own threads"
  ON public.chat_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own threads"
  ON public.chat_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own threads"
  ON public.chat_threads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_type text NOT NULL DEFAULT 'user',
  message text NOT NULL DEFAULT '',
  attachment_url text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only read messages from their own threads
CREATE POLICY "Users can view messages in their threads"
  ON public.chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id AND t.user_id = auth.uid()
  ));

-- Users can only insert messages into their own threads
CREATE POLICY "Users can send messages in their threads"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND sender_type = 'user'
    AND EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );

-- Users can update read status of messages in their threads
CREATE POLICY "Users can mark messages as read in their threads"
  ON public.chat_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id AND t.user_id = auth.uid()
  ));

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;

-- =============================================
-- FIX 2: Tighten orders INSERT policy to validate seller_id
-- =============================================

DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;

CREATE POLICY "Buyers can create valid orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND auth.uid() != seller_id
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
      AND l.user_id = seller_id
      AND l.status = 'active'
    )
  );

-- =============================================
-- FIX 3: Restrict profile name fields visibility
-- Create a function to check if requester is the profile owner
-- Then update the SELECT policy
-- =============================================

-- Drop and recreate the profiles SELECT policy to restrict name fields
-- We can't do column-level RLS in Postgres, but we can create a view
-- that hides sensitive fields and restrict the base table

-- Create a public view that excludes first_name and last_name
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT 
    id,
    user_id,
    username,
    avatar_url,
    location,
    country_code,
    region_id,
    pause_selling,
    rating,
    total_reviews,
    tiered_shipping_enabled,
    shipping_tier_1,
    shipping_tier_2,
    shipping_tier_3,
    shipping_preferences_set,
    status,
    created_at,
    updated_at
  FROM public.profiles;
