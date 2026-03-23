ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS paypal_merchant_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS paypal_onboarding_complete BOOLEAN NOT NULL DEFAULT false;