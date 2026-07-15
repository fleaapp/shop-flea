## Changes

### 1. `src/components/InstallAppBanner.tsx`
- Replace the current logo `src="/src/assets/flea-logo-transparent.png"` with the auth-screen logo: `import fleaLogoAuth from '@/assets/flea-logo-auth.jpeg'` and use it as the `<img src>`. This is the green-background Flea mark used on the auth screen.
- Keep existing spacing, centering, lime background, and copy as-is.

### 2. `src/hooks/useIsWebSharedPreview.ts`
- Add an auth check so the hook only returns `true` when the visitor is:
  - Not in Capacitor native
  - Not in a standalone/installed PWA
  - AND not signed in
- Implementation: subscribe to `supabase.auth.getSession()` + `onAuthStateChange`. Return `true` only when there is no active session (in addition to the existing web/non-PWA checks).

### 3. `src/pages/ListingDetails.tsx` (no behavior change beyond what the hook returns)
- Already uses `useIsWebSharedPreview()` to gate banner + hide sticky Buy/Message footer, so once the hook is updated, logged-in users on web will no longer see the banner and will see the normal action buttons. Logged-out mobile web visitors will see the banner and no action buttons, nudging them to download rather than log in on the web.

## Result
- Banner uses the same green Flea logo as the auth screen.
- Banner appears only for logged-out visitors viewing a listing on mobile web (shared link previews); it never appears for signed-in users, native app, or installed PWA.
