## Fix

Hardcode sarahhearn2 as admin on the client so the Settings badge never waits on a network validation.

### Changes

**`src/hooks/useAdminRole.ts`**
- Add a constant `HARDCODED_ADMIN_EMAILS = ['sarahhearn02@gmail.com']` (and match on `profile.username === 'sarahhearn2'` as a backup).
- At the top of the effect, if the current `user.email` (or profile username) matches, synchronously set `isAdmin = true` and `loading = false` — skip the `admin-check-role` fetch entirely.
- Everyone else keeps the existing edge-function check.

Result: on every mount for sarahhearn2, `isAdmin` is `true` on render 1, `useAdminBadges` is enabled immediately, and the Settings footer badge no longer flashes or disappears while validating.

### Out of scope

- No server-side role changes (the `user_roles` row remains the source of truth for edge-function–gated actions).
- No visual changes.
