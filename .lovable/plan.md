# Fix native Google sign-in nonce failure, stuck picker, and account-deletion stall

## What is actually going wrong

Confirmed from the backend auth logs: every native Google attempt fails at `POST /token` with

```text
grant_type=id_token -> 400 "Passed nonce and nonce in id_token should either both exist or not."
```

The native Google SDK always mints its own `nonce` and stamps it into the ID token, but the app calls `signInWithIdToken` without sending that nonce back. The backend sees a nonce in the token and nothing in the request, so it rejects it. This is a pure wiring bug - it fails 100% of the time, for every account, deleted or not.

Two knock-on effects seen in the screenshot:

- **"Sign back in" on a deleted account** - a stale local session survived on the device. Deleting a user in the backend does not wipe the token stored on the phone; the app only discovers it is invalid on the next refresh (the logs also show `Invalid Refresh Token: Refresh Token Not Found`).
- **Google button will not reopen** - the native plugin keeps the previously chosen account, and the failed attempt leaves the in-app "busy" flag set, so the second tap re-renders the old error instead of opening the picker.

Separately confirmed: `handleConfirmDelete` in Edit Profile has no pending state, so the dialog just sits there while the deletion runs.

## The fix

1. **Send the nonce back.** After the native picker returns, read the `nonce` claim straight out of the returned ID token and pass it to the backend sign-in call, so token and request always agree. Reading it from the token itself (rather than generating one) is immune to whether the platform hashes it.
2. **Always show the account picker.** Turn on the force-prompt option and sign the plugin out of its cached Google session before each attempt, so a different Google account can always be chosen.
3. **Recover cleanly from failure.** Reset the busy flag and the plugin's initialised state in every exit path (success, error, cancel), so a second tap starts a fresh attempt rather than replaying the last error.
4. **Purge dead sessions.** On app start and whenever a token refresh fails with "refresh token not found" or "user not found", clear the local session and land the user on the sign-in screen - no "sign back in" prompt for an account that no longer exists.
5. **Deletion loading state.** Disable the confirm button and show a "Deleting your account..." pending state while the request runs, keeping the dialog locked until it finishes, then sign out and return to the sign-in screen.

## Technical notes

- `src/lib/googleSignIn.ts`: decode the JWT payload of the returned `idToken`, pass `nonce` through to `supabase.auth.signInWithIdToken`; add `forcePrompt: true` and a guarded `SocialLogin.logout({ provider: 'google' })` before `login`; move state resets into a `finally`.
- `src/pages/Auth.tsx`: clear the Google busy flag on error so the button is tappable again.
- Session purge: in the existing auth bootstrap, treat `refresh_token_not_found` / `user_not_found` as a hard sign-out (`supabase.auth.signOut({ scope: 'local' })`) rather than an error toast.
- `src/pages/EditProfile.tsx`: add `isDeletingAccount` state around `invokeCloudFunction('delete-account')`, wire it to the confirm button's disabled/label and block dialog dismissal while it is true.
- No database or edge-function changes needed.
