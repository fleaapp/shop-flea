# Remove the green screen after Google sign-in, before the username step

## What's happening

Between Google returning and the "Introduce yourself" screen, the app sits on a plain lime screen. That gap is several blocking steps run one after another, each showing the lime app-chrome background:

1. The callback screen itself renders a bare lime page (`/auth/callback`) while it exchanges the OAuth code for a session.
2. On sign-in, the auth context awaits the `resolve-oauth-conflict` edge function - a full cold-start round trip - before it even starts loading the profile.
3. Only then does it fetch the profile, and the whole time the global auth "loading" flag is true, so the home route renders just a spinner on the lime background.
4. The home screen is a lazy chunk, so it downloads and mounts after all of the above, and the username dialog appears last.

Nothing is broken - it's four sequential waits with no feedback.

## Fix

1. Give the wait a real screen instead of blank lime.
   - The callback route shows the Flea logo with a "Signing you in" state on brand background, matching the auth screen, rather than an empty lime rectangle.
   - The signed-in loading state on the home route uses the same branded screen, so the transition is one continuous visual rather than lime -> spinner -> feed.

2. Stop the duplicate-account check from blocking sign-in.
   - Run `resolve-oauth-conflict` in parallel with the profile fetch instead of awaiting it first. If it comes back with a conflict, the existing sign-out and conflict dialog still fire; if not, nothing is delayed.

3. Start the home screen loading earlier.
   - Prefetch the home chunk while the callback is still exchanging the code, so it is already in memory when the session lands.

4. Show the username step as soon as the profile is known.
   - The profile fetch is the only thing the username dialog actually depends on; the feed query no longer needs to settle first.

## Result

Google sheet closes -> branded "Signing you in" screen for the length of one round trip -> username screen. No blank lime gap.

## Technical scope

- `src/pages/AuthCallback.tsx` - branded loading screen, prefetch the home chunk.
- `src/context/AuthContext.tsx` - run the OAuth conflict check alongside the profile fetch instead of before it.
- `src/components/ProtectedRoute.tsx` - branded loading screen instead of a bare spinner.
- `src/App.tsx` - expose the home-route prefetch to the callback page.

No database or edge function changes.
