## Plan to fix the Xcode simulator green hourglass stall

The meaningful error is not the `UIScene`, WebPrivacy, RTI, or network noise. The actionable line is:

```text
JS Eval error A JavaScript exception occurred
TypeError: undefined is not an object (evaluating 'window.Capacitor.triggerEvent')
```

That means the native WebView is trying to fire Capacitor lifecycle events before the Capacitor JS bridge is ready. The repeated `App.addListener` and `StatusBar` calls show our app is registering native listeners very early and more than once.

There is also still one exact green-screen/hourglass path in the app: `ResetPassword.tsx` renders `fixed inset-0 bg-primary` with `⏳` while waiting for `supabase.auth.getSession()`, with no timeout. If the simulator has restored or retained `/reset-password`, it can look like “before auth” forever.

## Changes I will make

1. **Remove duplicate early native App listeners**
   - Stop registering Capacitor `App.addListener('resume')` / `appStateChange` in both `src/lib/appChrome.ts` and `src/App.tsx`.
   - Keep one guarded native-listener path only, after React has mounted.

2. **Make native status bar updates safe**
   - Debounce/guard `StatusBar.setOverlaysWebView`, `setStyle`, and `setBackgroundColor` so they do not spam native calls during boot.
   - Only run them when `window.Capacitor` is actually present and native.

3. **Fix the remaining indefinite green hourglass**
   - Update `src/pages/ResetPassword.tsx` so `getSession()` cannot leave the screen stuck.
   - Add a short fallback timeout/error path that routes back to `/auth` or shows a normal auth-facing fallback instead of a green hourglass forever.

4. **Add native boot diagnostics that show in Xcode/Web Inspector**
   - Add a tiny boot log around route, protocol, bridge availability, and first React render.
   - This will confirm whether the simulator is actually opening `/auth`, `/`, or a retained `/reset-password` route.

5. **Validation target**
   - Verify the web preview still loads `/auth` normally.
   - For native, the expected result after sync/run is: no permanent green hourglass; either the auth form appears or an explicit error/fallback appears.

## What this avoids

- I will not change backend/auth rules.
- I will not keep chasing network requests, because your latest logs show the WebView loaded and the issue is now native boot/lifecycle handling.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>