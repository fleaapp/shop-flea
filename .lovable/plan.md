## Plan to make auth appear immediately after the native splash

1. **Remove the extra green-screen gap**
   - Change the native splash handoff so the first WebView frame is the actual auth screen, not an empty lime fallback.
   - Stop showing the current full-screen auth fallback unless a genuinely lazy auth route is loading.

2. **Make `/auth` part of the initial bundle**
   - Keep the login screen eager, but reduce what it pulls in before first paint.
   - Replace heavy `lucide-react` auth icons with tiny inline SVGs or lightweight local components so the auth page does not load the full icon bundle before rendering.
   - Defer non-critical auth-only UI, especially `ProviderConflictDialog`, until it is actually needed.

3. **Move auth-session checking off the first visual paint**
   - Let `AuthProvider` render children immediately instead of holding startup behind `getSession()` state.
   - Run the session check after mount and redirect only if a valid user session exists.
   - Keep the safety timeout, but lower its impact so signed-out users never wait on the network before seeing auth.

4. **Clean native boot diagnostics for production startup**
   - Remove remaining startup console diagnostics and duplicate chrome restore listeners from `main.tsx` that are useful for debugging but unnecessary for real-device launch.
   - Keep the native `SplashScreen.hide()` call immediate.

5. **Verify the result**
   - Check `/auth` in the preview performance profile for improved FCP and no error overlay.
   - You’ll then run:
   ```bash
   git pull && npm install && npm run ios:fresh
   ```
   If the old app is still visible on the phone, delete Flea from the iPhone once and run the command again.