## Goal

Prevent duplicate accounts when the same email is used across different sign-in methods (email/password, Google, Apple). When a conflict is detected, show a dialog that auto-redirects the user to the correct provider they originally signed up with.

## How it works

1. **Track original provider** on every account in a new `auth_provider` column on `profiles` (`email` | `google` | `apple`).
2. **Before any sign-up attempt**, call an edge function that looks up the email in `auth.users` (service role, server-side) and returns its provider — or `null` if the email is free.
3. If the email already exists with a different provider, **cancel the sign-up/sign-in attempt** and show a dialog: *"This email is already registered with Google. Continue with Google to sign in."* → on Continue, auto-trigger the correct OAuth flow.
4. If it matches the same provider, proceed normally.

## Files

### Database (1 migration)
- Add `auth_provider text` column to `profiles`.
- Update `handle_new_user()` trigger to populate it from `NEW.raw_app_meta_data->>'provider'` (falls back to `'email'`).
- Backfill existing rows by reading `auth.users.raw_app_meta_data->>'provider'`.

### Edge function (new): `supabase/functions/check-email-provider/index.ts`
- POST `{ email }` → returns `{ provider: 'email' | 'google' | 'apple' | null }`.
- Uses `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` per project convention; case-insensitive lookup against `auth.users.email`.
- Rate-limited via existing `check_and_record_rate_limit` RPC (10/min per IP) to prevent email enumeration abuse.
- `verify_jwt = false` (public, called pre-auth).

### Frontend
- **New component** `src/components/ProviderConflictDialog.tsx` — small confirm dialog matching the existing `mem://style/ui-elements/confirmation-dialog-style` (max-w 280-340, rounded-2xl, lime CTA). Shows: *"This email is registered with {Google/Apple/email & password}. {CTA}"*. CTA = "Continue with Google" / "Continue with Apple" / "Log in with password" → triggers the right flow on click.
- **`src/pages/Auth.tsx`** — three changes:
  1. `handleSignup`: replace the dummy-password probe with a call to `check-email-provider`. If `provider` is `'google'`/`'apple'` → open dialog. If `'email'` → existing "already registered, log in" toast + switch to login tab.
  2. `handleGoogleSignIn`: before redirect, prompt user for the email is impossible (Google chooses), so we add a **post-callback guard**: after Supabase returns, check `user.app_metadata.provider` vs `profiles.auth_provider`. If mismatch and the profile already existed before this sign-in, sign the user out immediately and open the dialog with the correct provider. (Edge case: rare, but covers users who pick the "wrong" Google account.)
  3. `handleAppleSignIn`: same post-callback guard. For native iOS Apple sign-in we get the email from `identityToken`, so we can also pre-check via `check-email-provider` before calling `signInWithIdToken`.
- **`src/context/AuthContext.tsx`** — on `SIGNED_IN` event, run the mismatch guard once: compare `session.user.app_metadata.provider` to `profiles.auth_provider`. If mismatch, sign out + emit a global event the Auth page listens for to open the dialog.

## Edge cases handled

- **Same provider, second sign-in**: pre-check returns same provider → proceed as normal login.
- **Brand-new email**: pre-check returns `null` → proceed with signup.
- **Apple "Hide my email"**: relay address is unique per app, so it's treated like any normal email — no special handling needed.
- **Google account picker shows wrong account**: post-callback guard catches it, signs out, shows dialog.
- **Race condition** (user creates account between pre-check and OAuth callback): post-callback guard catches it.
- **Enumeration abuse**: rate-limit on `check-email-provider` + only reveals "this email is registered" when user is already attempting to sign up with it (same info the existing dummy-password probe leaks).

## Out of scope

- Actual account merging (Supabase manual-linking would be needed). Users with two existing duplicate accounts from before this change keep them; this only prevents *future* duplicates.
- Phone/SMS provider (not enabled).
- Changing email on an existing account.

## Technical notes

- All Supabase writes go through the project's "external Supabase via service role" pattern per `mem://infrastructure/supabase-configuration-external-persistence`.
- Dialog styling follows `mem://style/ui-elements/confirmation-dialog-style`.
- "Stripe/Supabase" naming rule doesn't apply here — provider names (Google, Apple) are surfaced to users intentionally.
