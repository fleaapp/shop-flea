Root cause: The "Introduce yourself!" welcome dialog (`WelcomeSetupDialog`) is briefly shown on cold boot / app resume.

- `Index.tsx` opens it when `needsProfileSetup = !!user && !authLoading && (!profile || ...)`.
- In `AuthContext.tsx` a 1.5s safety timer force-clears `loading` even if the profile fetch is still in flight. On native cold boot / resume the auth session restores fast but the profile fetch can lag, so there is a window where `user` is set, `authLoading` is false, and `profile` is still `null` — the dialog flashes until the profile arrives.
- The `getSession()` path also clears `loading` as soon as `fetchProfile` settles, but if that returns an error/timeout with no row, we still can't distinguish "not fetched yet" from "fetched, empty".

Fix plan:
1. Track a distinct `profileLoaded` flag in `AuthContext.tsx`
   - Starts `false`, becomes `true` only after `fetchProfile` completes (success or empty), and resets `false` on sign-out / user change.
   - Expose it via context alongside `profile` and `loading`.
   - Do not have the 1.5s safety timer set `profileLoaded` — only `loading`.

2. Gate the welcome dialog on `profileLoaded` in `Index.tsx`
   - Change `needsProfileSetup` to also require `profileLoaded === true` before evaluating the missing-field checks.
   - This prevents any flash during the `user-known / profile-loading` window on cold boot or app resume.

3. No visual/layout changes
   - Do not touch `OnboardingOverlay`, `OnboardingCarousel`, `WelcomeSetupDialog`, or any styling.
   - Do not change the onboarding trigger logic for genuine new users — they still see the dialog exactly once, just no longer flashed on returning-user cold boot.

4. Verify
   - Confirm on cold boot for an existing signed-in user: cream screen → spinner → home feed, with no welcome dialog frame in between.
   - Confirm a genuine new user (with `flea-new-user-pending-onboarding = 'true'` and an incomplete profile) still gets the dialog exactly once.