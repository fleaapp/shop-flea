## Plan

Do I know what the issue is? Yes: the green screen plus hourglass is app-rendered UI, not the native splash screen or the harmless `interactive-widget` warning. In the current web preview, `/auth` renders the login form, so Xcode is very likely still loading an old copied web bundle or a remaining protected-route/listings loader is being hit before `/auth`.

### What I will change

1. **Make `/auth` impossible to stall**
   - Keep the auth page rendering the login form immediately.
   - Remove unused location-loading state/imports from the auth page so `ipapi.co` can no longer influence the auth screen at all.

2. **Remove the hourglass loading UI from app startup paths**
   - Replace the `ProtectedRoute` hourglass screen with an immediate redirect to `/auth` when auth is unresolved or signed out.
   - Replace the home listing `⏳` loader with a non-blocking skeleton/message so users never see the same green/hourglass stall again.

3. **Make native builds clearly identifiable**
   - Add a small always-visible build stamp early in the app so you can tell instantly whether Xcode is running the new bundle.
   - Keep the debug overlay mounted outside the route tree, so it survives route crashes/stalls.

4. **Stop native from using web/PWA cache behavior**
   - Disable service worker/cache registration when running inside Capacitor native, because native apps ship local files and should not rely on PWA caching.
   - Remove the invalid `interactive-widget=resizes-content` viewport token so that warning stops distracting from real issues.

5. **Give you one clean Xcode deploy command**
   - After code changes, I’ll provide one exact rebuild/sync command that removes the copied iOS public web bundle before syncing, so Xcode cannot keep serving stale web assets.

### Files I expect to update

- `src/pages/Auth.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/Index.tsx`
- `src/main.tsx`
- `index.html`

### Expected result

On the next native run, either the login page appears immediately, or the visible build stamp proves whether Xcode is still serving an old bundle. The lime-green hourglass loading screen will no longer exist in the app paths that run before auth.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>