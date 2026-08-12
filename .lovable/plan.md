# Fix "Google sign-in failed: Nonces mismatch"

## What the logs show

The backend auth log for your attempts at 04:24 and 04:25 records:

```text
POST /token  grant_type=id_token  ->  400  "invalid nonce: Nonces mismatch"
```

This is a different error from the earlier one ("both exist or not"). The previous fix - reading the `nonce` claim out of the Google ID token and sending it along - got past the "missing nonce" rejection, but now fails the comparison.

## Why it mismatches

I read the auth server's actual comparison code. It does not compare the two values directly - it hashes what the app sends and compares that hash to the claim in the token:

```text
hash = sha256_hex(nonce the app sent)
if hash != nonce claim inside the ID token  ->  "Nonces mismatch"
```

Google puts the value it was given into the token verbatim. So the current code takes that value back out and sends it, the server hashes it a second time, and the two can never match. It fails 100% of the time, which matches what you are seeing.

The app has to own the nonce instead of reading it back out:

```text
app generates raw nonce
  -> sends SHA-256(raw) to the Google SDK   (Google copies it into the ID token)
  -> sends raw to the backend               (backend hashes it, matches)
```

## Pre-checks I ran so this is the last build

Rather than assume, I confirmed each link in the chain against the actual source in the project:

- **Server side** - confirmed the comparison is `sha256` hex of the submitted nonce against the token claim. This is the exact line producing your error.
- **iOS plugin** - confirmed `options.nonce` is read from the login payload and handed straight to Google's iOS SDK. No hashing, no rewriting.
- **Android plugin** - confirmed the same value is passed through to Google's credential API, so Android behaves identically.
- **Token location** - confirmed the plugin returns the ID token at `result.authentication.idToken`, which is exactly where the current code already reads it. No parsing change needed.
- **Audience** - the failed requests reached the nonce check, which only happens after the token's audience has already been accepted. So the client IDs are correctly configured and are not a second problem waiting behind this one.

### One real trap found, and how the fix avoids it

The iOS plugin has a shortcut path: if a previous Google session exists it silently reuses the cached token instead of showing the picker - and that cached token carries an **old** nonce, which would fail in exactly the same way. That path is skipped only while `forcePrompt` is true. The current code already sets `forcePrompt: true`, and the fix keeps it, plus keeps the sign-out before each attempt. This is called out so it does not get "tidied away" later and silently reintroduce the bug.

## The fix

In `src/lib/googleSignIn.ts`:

1. Generate a random raw nonce per sign-in attempt.
2. Compute its SHA-256 hex digest via `crypto.subtle.digest`.
3. Pass the **hashed** value as the `nonce` option to the plugin's `login`.
4. Pass the **raw** value to `supabase.auth.signInWithIdToken`.
5. Remove `nonceFromIdToken` - reading the claim back out is what causes the double hash.
6. Keep `forcePrompt: true` and the pre-login sign-out, for the cached-token reason above.
7. Add a guard: if the returned token's nonce claim does not equal the hash we sent, do not send a request that is guaranteed to fail - fall back to the in-app browser flow so the user still gets signed in.

Everything else stays as it is - the account picker, the busy-flag reset in `finally`, and the browser fallback.

## Scope and risk

- Only `src/lib/googleSignIn.ts` changes. No database, edge function, Info.plist, Google Cloud, or native project changes, so nothing that affects App Review or the archive pipeline moves.
- `crypto.subtle` is available in the iOS WKWebView under the app's https origin, so no polyfill and no new dependency.
- Apple sign-in, email sign-in and web/PWA Google sign-in are untouched.
- Worst case if something still surprises us on device: point 7 means the user falls through to the existing browser flow rather than hitting a dead end.

## Verification after the build

A successful attempt shows `POST /token grant_type=id_token -> 200` in the auth log instead of the 400, and the app lands on the username step. I can read that log directly once you have tried it.
