ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_apple_reviewer boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET is_apple_reviewer = true
WHERE user_id = '5883f33c-07f3-4f6a-9a2d-a7e0ea864142';