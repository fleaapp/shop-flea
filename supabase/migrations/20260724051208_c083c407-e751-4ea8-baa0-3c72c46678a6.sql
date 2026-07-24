ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_category_valid;
ALTER TABLE public.listings ADD CONSTRAINT listings_category_valid
  CHECK (category = ANY (ARRAY[
    'tops','outerwear','bottoms','dresses','playsuits-jumpsuits',
    'sleepwear','underwear','activewear','swimwear',
    'shoes','accessories','bags','other'
  ]));