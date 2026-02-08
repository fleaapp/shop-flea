-- Add unique constraint on waitlist email to prevent duplicates
ALTER TABLE public.waitlist
ADD CONSTRAINT waitlist_email_unique UNIQUE (email);

-- Add region_id to waitlist based on country_code
-- Update waitlist INSERT policy to also store region_id
CREATE OR REPLACE FUNCTION public.set_waitlist_region()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Look up the region_id from the countries table based on country_code
  SELECT c.region_id INTO NEW.region_id
  FROM public.countries c
  WHERE c.code = NEW.country_code;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-set region_id on waitlist insert
DROP TRIGGER IF EXISTS set_waitlist_region_trigger ON public.waitlist;
CREATE TRIGGER set_waitlist_region_trigger
BEFORE INSERT ON public.waitlist
FOR EACH ROW
EXECUTE FUNCTION public.set_waitlist_region();