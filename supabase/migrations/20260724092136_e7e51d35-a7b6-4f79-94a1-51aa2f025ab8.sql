CREATE OR REPLACE FUNCTION public.listings_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.region_id IS DISTINCT FROM OLD.region_id
     OR NEW.report_count IS DISTINCT FROM OLD.report_count
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Modification of protected listing fields is not allowed';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('sold','removed','blocked') THEN
      RAISE EXCEPTION 'Cannot change status from %', OLD.status;
    END IF;
    IF NEW.status NOT IN ('active','paused','archived','sold','removed') THEN
      RAISE EXCEPTION 'Invalid status transition to %', NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;