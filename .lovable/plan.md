## Problem

Login fails with HTTP 500 `Database error granting user`. Auth logs show:

```
error update user`s last_sign_in field: ERROR: Modification of protected profile fields is not allowed (SQLSTATE P0001)
```

## Root cause

On every successful sign-in, GoTrue updates `auth.users.last_sign_in_at`. Our trigger `update_last_sign_in` (SECURITY DEFINER) mirrors that into `public.profiles.last_sign_in_at`. That UPDATE then hits `profiles_update_guard`, which lists `last_sign_in_at` in its protected-fields block and only bypasses when `auth.role() = 'service_role'`.

Inside GoTrue's login transaction the effective role is `supabase_auth_admin`, not `service_role`, so the guard raises and the entire token grant rolls back. This blocks ALL email/password logins on the migrated Cloud database.

## Fix

Migration that updates `public.profiles_update_guard()` to permit `last_sign_in_at` changes coming from the mirror trigger, while keeping every other field protected. Two options, will use option A:

- **A (chosen):** Remove `last_sign_in_at` from the protected list. It is only ever written by the `update_last_sign_in` trigger firing off `auth.users`; users cannot forge a value because they cannot write to `auth.users`.
- B: Also allow when `session_user = 'supabase_auth_admin'`. More surface area, not needed.

## Verification

1. Confirm `supabase--cloud_status` is `ACTIVE_HEALTHY`.
2. Apply migration.
3. Reproduce login for `sarahhearn02@gmail.com` from the preview (user will test) and confirm 200 on `/auth/v1/token`.
4. Check `profiles.last_sign_in_at` updated for that user.

No client code changes.
