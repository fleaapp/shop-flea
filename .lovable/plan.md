# Google sign-in button missing on TestFlight

## What I checked

The Google button in `src/pages/Auth.tsx` is rendered unconditionally, next to the Apple button, with no platform check, no feature flag, and no CSS rule that hides it. Rendering the auth screen at iPhone sizes (390x664 and 375x553) shows both icons fully on screen, not clipped.

So the code that ships today does render it. That leaves two realistic causes on the device, and the plan handles both.

## Cause A: the device is running an older bundle

Capacitor serves the copy of `dist/` that was inside the iOS project at archive time. If `npm run build` ran before the latest pull, or `npx cap sync ios` did not re-copy `dist/` into `ios/App/App/public`, the device shows the older auth screen that had no Google button - with no error of any kind. This matches the symptom exactly (silent absence, not a broken tap).

Fix: make the shipped bundle self-identifying.

- Add a tiny build stamp (short build id + date) baked in at build time via Vite `define`.
- Show it as small muted text at the very bottom of the auth screen.
- With that in place, one look at the TestFlight auth screen tells us whether the device is on the current bundle.

## Cause B: the inline SVG does not paint in WKWebView

The Google icon is a bare inline `<svg>` with `fill="currentColor"` on a dark button. If the icon fails to paint on device, the button is a 40x40 dark square with nothing in it - visually reading as "no Google option" next to the Apple icon.

Fix: make the option impossible to miss regardless of icon rendering.

- Give the Google and Apple buttons an accessible visible fallback so the control is still identifiable if the glyph fails.
- Keep the existing size, shape and dark `bg-ink` styling so the row looks unchanged.

## Then verify

After a fresh `npm run build` + `npx cap sync ios` + archive:

1. Open the TestFlight auth screen and read the build stamp - it must match the new build.
2. Confirm both Google and Apple controls are present on the login and signup tabs.
3. Tap Google and confirm the in-app browser sheet opens with the Flea-branded consent screen.

## Technical notes

- `vite.config.ts`: add `define` entries for the build id and build time.
- `src/vite-env.d.ts`: declare the injected globals.
- `src/pages/Auth.tsx`: render the build stamp under "Browse as Guest"; adjust the two social buttons for the icon fallback.
- No backend, auth-config, or OAuth-flow changes - the sign-in logic itself is untouched.
