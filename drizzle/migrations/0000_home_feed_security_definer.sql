-- The home feed must see every seller's status/pause/last-active to filter them.
-- Without SECURITY DEFINER, profile RLS hides other sellers, the LEFT JOIN yields NULLs,
-- and inactive/paused/blocked sellers slip into the card stack.
ALTER FUNCTION public.get_home_feed(integer, integer) SECURITY DEFINER;
ALTER FUNCTION public.get_home_feed(integer, integer) SET search_path TO 'public';
REVOKE ALL ON FUNCTION public.get_home_feed(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_feed(integer, integer) TO anon, authenticated, service_role;