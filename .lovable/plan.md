# Google button missing from TestFlight - fix the native packaging path

## Confirmed from the screenshot

The screenshot rules out an icon-rendering problem. Apple is centered by itself; if Google's SVG had merely failed to paint, the two-button flex row would still reserve Google's 40px square and Apple would sit to the right. The Google React node is not in the JavaScript bundle running on TestFlight.

The current `src/pages/Auth.tsx` always renders Google before Apple with no native/platform condition. `capacitor.config.ts` also confirms native must load bundled `dist/`, not a remote URL. However, this repository does not contain `ios/App/App/public`, so the generated native bundle lives only in the local Xcode checkout and cannot be validated or refreshed by Git alone.

This identifies the actual fault boundary: the TestFlight archive is receiving an older generated Capacitor web bundle, even though the TypeScript source is current.

## 1. Make one command produce an archive-ready iOS bundle

- Replace the loose manual build sequence with an `ios:archive-ready` script that deletes `dist`, creates a production Vite build, runs `cap sync ios`, applies the existing native iOS setup/entitlement patches, and then validates the copied files.
- Fail the command if `ios/App/App/public` is missing, if its generated assets do not contain the current Google control marker, or if the copied native `index.html` does not point at the just-built assets.
- Print a clear "safe to archive" result only after those checks pass.

This prevents Xcode from archiving stale web files again.

## 2. Add a visible native build stamp

- Use the existing Vite build ID and add a readable build date.
- Show a subtle version/build stamp beneath "Browse as Guest" only in native builds, so the web auth screen stays unchanged.
- Print the same stamp from `ios:archive-ready`, allowing the TestFlight screen to be matched directly to the local archive inputs.

## 3. Preserve the current auth design and flow

- Keep the existing two square Google/Apple icon controls shown in the screenshot; no unnecessary redesign to labelled pills.
- Keep the current Flea-branded in-app OAuth sheet and `prompt: select_account` behavior unchanged.
- Add a native-only console marker listing the enabled social controls, useful if a future archive differs from source again.

## Build steps for the next TestFlight

Run one command from the project root after pulling the change:

```text
npm run ios:archive-ready
```

Only archive after that command reports that the Google marker is present in the copied iOS bundle. Then bump the Xcode build number and archive without running any command that overwrites the generated public folder.

## Then verify on device

1. Auth screen shows the build stamp printed by `ios:archive-ready`.
2. Google and Apple icons are both visible on the login and signup tabs.
3. Tapping Google opens the in-app browser sheet with the Flea-branded consent screen.

## Technical notes

- `scripts/prepare-ios-archive.mjs`: perform clean build, sync, native patching, and copied-bundle assertions.
- `package.json`: add `ios:archive-ready`; keep `ios:fresh` as a development shortcut.
- `src/pages/Auth.tsx`: add the native-only build stamp and diagnostic marker without changing the social-button layout.
- `vite.config.ts` / `src/vite-env.d.ts`: expose the readable build date alongside the existing build ID.
- No backend, auth-config, Google Cloud, or OAuth-flow changes.
