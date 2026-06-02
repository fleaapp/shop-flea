ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web';

ALTER TABLE public.push_subscriptions
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_platform
  ON public.push_subscriptions (user_id, platform);