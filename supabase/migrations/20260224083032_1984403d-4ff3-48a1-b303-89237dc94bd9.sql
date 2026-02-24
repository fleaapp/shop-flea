-- Change preferred_gender from text to text[] to support multi-select
ALTER TABLE public.profiles 
  ALTER COLUMN preferred_gender TYPE text[] 
  USING CASE 
    WHEN preferred_gender IS NULL THEN '{}'::text[]
    ELSE ARRAY[preferred_gender]
  END;

ALTER TABLE public.profiles 
  ALTER COLUMN preferred_gender SET DEFAULT '{}'::text[];