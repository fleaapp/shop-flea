## What's missing

After the migration to Lovable Cloud, the `public.user_roles` table is empty — so @sarahhearn2 (`6b0dd9d6-dee9-4f6d-8d4f-d3c191404c0b`) no longer has the `admin` role. The Admin Dashboard gate (`useAdminRole` → `admin-check-role` edge function → `has_role()`) returns false, hiding all admin tabs and blocking every admin edge function.

Everything else the admin dashboard reads is intact in Cloud:
- `brands`: 128 rows
- `error_logs`: 9 rows
- `coupons`: 1 row (FREEFLEA)
- Listings, users, transactions, refunds all present

## Fix

Insert one row into `public.user_roles` re-granting @sarahhearn2 the `admin` role:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('6b0dd9d6-dee9-4f6d-8d4f-d3c191404c0b', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Then verify by reloading the app — the Admin tab should reappear in Settings and all admin pages (Users, Listings, Transactions, Refunds, Brands, Error Logs) should load.

## Note

If any other accounts previously held `admin` or `moderator` roles on the old project, tell me the usernames and I'll grant those too in the same migration.
