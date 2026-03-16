
-- Update existing 'new with tags' values to 'new'
UPDATE public.listings SET condition = 'new' WHERE condition = 'new with tags';

-- Drop old constraint and add updated one
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_condition_valid;
ALTER TABLE public.listings ADD CONSTRAINT listings_condition_valid CHECK (
  condition IN ('new', 'like new', 'good', 'fair')
);
