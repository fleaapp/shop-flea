-- Drop the outdated size constraint that only allows basic letter sizes
-- The new size system supports numeric sizes for bottoms (20-50 inches) and shoes (AU 3-17 with half sizes)
ALTER TABLE public.listings DROP CONSTRAINT listings_size_valid;