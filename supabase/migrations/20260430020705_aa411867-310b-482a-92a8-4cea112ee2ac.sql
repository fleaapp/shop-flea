-- Re-attach the auto-profile-creation trigger to auth.users.
-- Without this, OAuth signups (and email signups if metadata is missing)
-- end up with no profile row, so they bypass username/region setup entirely.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();