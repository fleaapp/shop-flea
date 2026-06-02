# Native Apple Sign-In on iOS

Replace the clunky Safari-bounce flow with Apple's native sheet inside the iOS Capacitor app. Web (PWA, browser) keeps the existing `supabase.auth.signInWithOAuth('apple')` flow unchanged.

## What changes

### 1. Add Capacitor plugin
- Install `@capacitor-community/apple-sign-in`
- No config changes needed in `capacitor.config.ts` (plugin is auto-registered)
- Bundle ID `com.finditonflea.app` already matches the Apple Services ID setup

### 2. New helper: `src/lib/appleSignIn.ts`
- Detects platform via `Capacitor.isNativePlatform()` + `Capacitor.getPlatform() === 'ios'`
- On iOS native: calls `SignInWithApple.authorize({ clientId: 'com.finditonflea.app', scopes: 'email name', redirectURI: '', state: <random>, nonce: <random> })`
- Takes the returned `identityToken` and passes it to `supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken, nonce })` — this skips the browser round-trip entirely and creates the session directly
- On web / Android: returns `null` so caller falls back to existing web OAuth path

### 3. Update `src/pages/Auth.tsx` → `handleAppleSignIn`
```text
if (iOS native) {
  try native flow → session set → useEffect redirects
} else {
  existing supabase.auth.signInWithOAuth('apple') web flow
}
```
- Wrap native call in try/catch; on user cancel (`error.code === '1001'`) silently dismiss, on other errors show toast and fall back to web flow as last resort.

### 4. Xcode capability (user action, one-time)
After `npx cap sync`, the user needs to open the iOS project in Xcode once and:
- Signing & Capabilities → **+ Capability** → **Sign in with Apple**
- Save — this writes the entitlement file

This is mandatory for native Apple Sign-In; without it the plugin call throws immediately. I'll include this in the response after implementation.

### 5. Apple Developer Console (user action, one-time)
The **App ID** `com.finditonflea.app` (not the Services ID) also needs "Sign in with Apple" enabled:
- Identifiers → App IDs → `com.finditonflea.app` → check "Sign in with Apple" → Save
- Services ID setup from earlier remains unchanged and is still used for web flow

## Why this works with existing Supabase setup

- `signInWithIdToken` validates the Apple JWT directly against Apple's public keys — no redirect, no Services ID lookup, no domain verification
- Same Supabase user is created/matched by email, so an iOS native sign-in and a web Apple sign-in resolve to the same account
- Duplicate-email Google-vs-Apple concern from earlier is unaffected — same auth.users row either way

## Files touched

- `package.json` (add dependency)
- `src/lib/appleSignIn.ts` (new, ~40 lines)
- `src/pages/Auth.tsx` (modify `handleAppleSignIn` only, ~15 line change)

## Out of scope

- Android (Apple Sign-In on Android still uses web OAuth — Apple doesn't provide a native Android SDK)
- Duplicate-account blocker (separate plan from earlier, still pending your go-ahead)
- Any change to the existing web/PWA Apple flow
