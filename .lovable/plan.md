# Splash screen: logo-only; keep "Signing you in" for auth only

## What’s happening

Every time the app opens it renders `BrandedLoadingScreen`, which shows the Flea logo **plus** the bouncing dots and "Signing you in" copy. That makes the normal cold-boot splash feel like an auth screen. The user wants a clean logo-only splash on open, and the "Signing you in" state only while actually signing up or logging in.

## Changes

1. **Create a dedicated splash component** (`src/components/SplashScreen.tsx`)
   - Brand lime background (`bg-primary`).
   - Only the `flea-logo-auth` image.
   - Logo sized larger than the current auth loader (e.g., `h-20`/`h-24` vs the current `h-12`) and vertically/horizontally centered.
   - No dots, no status text.

2. **Use the new splash for app-level loading** (`src/components/ProtectedRoute.tsx`)
   - Replace all three `BrandedLoadingScreen` usages in `ProtectedRoute` with `SplashScreen`.
   - This covers the normal "open app while auth/session is still hydrating" state.

3. **Keep the existing branded loader for actual auth flows**
   - `src/pages/AuthCallback.tsx` continues to use `BrandedLoadingScreen` (logo + dots + "Signing you in") while exchanging the OAuth code.
   - `src/pages/Auth.tsx` line 482 keeps `BrandedLoadingScreen message="Signing you in"` after password-based sign-up so the transition to onboarding is covered.
   - The Google/Apple "Connecting..." overlay in `Auth.tsx` already has its own branded state and is unchanged.

4. **(Optional) Make the iOS native launch screen logo bigger** (`ios-launch-screen/LaunchScreen.storyboard`)
   - The native launch screen already shows only the `Splash` image centered on the lime background.
   - Increase the image width constraint from 50% to ~65% of the view so the logo feels closer to the new in-app splash size.

## Result

- Normal app open: clean logo-only splash, larger and centered.
- Sign-up / log-in flows: still see the logo + dots + "Signing you in" branded loader.
- No database or edge function changes.
