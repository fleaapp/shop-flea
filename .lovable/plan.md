# Fix "Google sign-in failed: Nonces mismatch"

## What the logs show

The backend auth log for your attempts at 04:24 and 04:25 records:

```text
POST /token  grant_type=id_token  ->  400  "invalid nonce: Nonces mismatch"
```

This is a different error from the earlier one ("both exist or not"). The previous fix - reading the `nonce` claim out of the Google ID token and sending it along - got us past the "missing nonce" rejection, but it now fails the comparison.

## Why it mismatches

The backend does not compare the two values directly. It takes the nonce the app sends, hashes it with SHA-256, and compares that hash to the `nonce` claim inside the ID token.

Google's native SDK already puts the **hashed** value into the token. So the current code takes the hash out of the token and sends the hash, the backend hashes it a second time, and the two never match. It will fail 100% of the time, which matches what you are seeing.

The app has to own the nonce rather than read it back out of the token:

```text
app generates raw nonce
  -> sends SHA-256(raw) to the Google SDK   (goes into the ID token)
  -> sends raw to the backend               (backend hashes it, matches)
```

The plugin already accepts a custom `nonce` option, so this is supported without changing anything native.

## The fix

In `src/lib/googleSignIn.ts`:

1. Generate a random raw nonce per sign-in attempt (crypto random, URL-safe).
2. Compute its SHA-256 hex digest via `crypto.subtle.digest`.
3. Pass the **hashed** value as the `nonce` option to `SocialLogin.login`.
4. Pass the **raw** value to `supabase.auth.signInWithIdToken`.
5. Remove `nonceFromIdToken` - reading the claim back out is exactly what causes the double hash.
6. Keep a safety check: if the returned token's `nonce` claim does not equal the hash we sent, treat it as a failed attempt and fall back to the in-app browser flow rather than sending a request that is guaranteed to 400.

Everything else stays as it is - the forced account picker, the pre-login logout, and the busy-flag reset in `finally` all remain.

## Technical notes

- Only `src/lib/googleSignIn.ts` changes. No database, edge function, Info.plist, or Google Cloud changes.
- `crypto.subtle` is available in the iOS WKWebView under the app's https origin, so no polyfill is needed.
- Requires a new TestFlight build to verify (`npm run ios:archive-ready`, then Clean Build Folder and Archive).

## Verification

After the new build, a successful attempt shows `POST /token grant_type=id_token -> 200` in the auth log instead of the 400, and the app lands on the username step.
