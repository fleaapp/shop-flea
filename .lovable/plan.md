# Google button still missing on TestFlight - make it unmissable and verifiable

## What the code actually does today

In `src/pages/Auth.tsx` the social row renders two identical 40x40 dark (`bg-ink`) squares side by side - Google first, Apple second - with no platform check, no flag, and no CSS that hides either one. The only difference between them is the inline SVG glyph inside. There is no text label on either button, and the row has no visible border, so an unpainted glyph leaves a dark square that reads as empty padding rather than a button.

Two ships with no change points at one of two things, and this plan removes both at once instead of guessing.

## 1. Replace the icon-only squares with labelled buttons

Icon-only dark squares are the weak point: if the Google glyph does not paint in the iOS WebView, there is literally nothing left to see.

- Swap both social controls for full-width pill buttons stacked vertically: "Continue with Google" and "Continue with Apple".
- Keep the existing `bg-ink` / `text-card` styling, rounded-full shape and the same 40px height so the screen still looks like Flea.
- Keep the icon inside each button to the left of the label, so a glyph failure costs the icon, not the whole control.
- No change to `handleGoogleSignIn` / `handleAppleSignIn` or the OAuth flow.

After this, if the button is genuinely on screen you will see the words "Continue with Google" - there is no longer an ambiguous dark square.

## 2. Add a build stamp so we can prove which bundle is on the device

Capacitor serves whatever copy of `dist/` was inside the iOS project at archive time. If the archive was made from a stale `dist/` (build ran before the pull, or `npx cap sync ios` did not re-copy), the device silently shows an older auth screen - exactly this symptom, with no error anywhere.

- Bake a short build id and date into the bundle at build time (Vite already injects `VITE_BUILD_ID`; expose a readable short form).
- Render it as small muted text under "Browse as Guest".
- On the next TestFlight build, read the stamp on the auth screen. If it does not match the build you just shipped, the problem is the archive pipeline, not the app code - and we will know instead of shipping a third time blind.

## Build steps for the next TestFlight

Run in this order from the project root after pulling the change:

```text
npm run build
npx cap sync ios
open ios/App/App.xcworkspace   # then Product > Archive
```

If `npm run build` is skipped, or Xcode archives without a fresh `cap sync`, the old bundle ships again.

## Then verify on device

1. Auth screen shows the build stamp matching the build you shipped.
2. "Continue with Google" and "Continue with Apple" are both visible on the login and signup tabs.
3. Tapping Google opens the in-app browser sheet with the Flea-branded consent screen.

## Technical notes

- `src/pages/Auth.tsx`: restructure the social block (lines around 634-673) into stacked labelled buttons; add the build stamp under the guest link.
- `vite.config.ts`: add a build-time define for a human-readable build date alongside the existing `VITE_BUILD_ID`.
- `src/vite-env.d.ts`: declare the injected constant.
- No backend, auth-config, Google Cloud, or OAuth-flow changes.
