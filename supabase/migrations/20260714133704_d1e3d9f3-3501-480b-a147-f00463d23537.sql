
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'waive_buyer_fee';
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS max_redemptions integer;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS redemption_count integer NOT NULL DEFAULT 0;

INSERT INTO public.coupons (code, description, type, active)
VALUES ('FREEFLEA', 'Removes the buyer Secure Checkout Fee.', 'waive_buyer_fee', true)
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, type = EXCLUDED.type, active = true;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_step text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text;
