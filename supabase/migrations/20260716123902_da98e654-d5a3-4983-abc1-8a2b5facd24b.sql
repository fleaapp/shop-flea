CREATE OR REPLACE FUNCTION public.brands_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.brand_name IS DISTINCT FROM OLD.brand_name
     OR NEW.display_name IS DISTINCT FROM OLD.display_name
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only usage_count may be updated on brands';
  END IF;

  RETURN NEW;
END;
$function$;