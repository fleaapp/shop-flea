# Fix missing `ios:archive-ready` script and harden TestFlight bundle pipeline

## Problem

Running `npm run ios:archive-ready` locally fails with `Missing script: "ios:archive-ready"`, even though the script is present in the cloud `package.json`. The most likely cause is the local clone being out of sync with the cloud repo. This is blocking the TestFlight archive workflow that was built to guarantee the Google sign-in button is included in the native bundle.

## Goals

1. Make the archive-preparation command available and runnable in the local environment.
2. Harden the pipeline so a stale or incomplete local clone cannot accidentally produce a TestFlight build missing the Google button.
3. Add clear, in-app and command-line diagnostics that prove which bundle is running on device.
4. Document the exact end-to-end TestFlight build steps so the same failure cannot happen again.

## Plan

### 1. Ensure local repo sync and script availability
- Confirm `scripts/prepare-ios-archive.mjs` and the `ios:archive-ready` entry in `package.json` exist in the cloud repo (already verified).
- Add a small `scripts/archive-ready.sh` wrapper that can be run directly with `bash scripts/archive-ready.sh` so the workflow is not blocked if `package.json` is temporarily out of sync.
- Update `package.json` to also expose a plain `archive-ready` script as a fallback.

### 2. Harden the prepare script against stale clones
- At the top of `prepare-ios-archive.mjs`, assert that the current working directory contains both `package.json` and `capacitor.config.ts`.
- If the Google auth control marker is missing from the built bundle, fail loudly with a clear message and non-zero exit code.
- After `npx cap sync ios`, re-run the marker assertion against `ios/App/App/public` and print a summary of included social-auth files.

### 3. Improve in-app bundle diagnostics
- In `src/pages/Auth.tsx`, render a small native-only build label (already present via `VITE_BUILD_ID`/`VITE_BUILD_DATE`) and add a second line that explicitly says whether the Google control marker was found in the bundle.
- Add a hidden `data-native-bundle-marker` attribute to the Google button container so the marker is guaranteed to survive minification.

### 4. Verify Google sign-in rendering on native
- Trace the native Google button visibility logic in `src/pages/Auth.tsx` and `src/lib/googleSignIn.ts`.
- Ensure the button is rendered unconditionally whenever `isPackagedNative` is true, with no early returns or feature flags that could hide it.
- Confirm the button uses the same Flea branding as Apple sign-in.

### 5. Document the exact TestFlight build flow
- Add a `TESTFLIGHT.md` file in the repo root with the minimal required steps:
  1. `git pull` from the connected GitHub repo.
  2. `npm install`.
  3. `npm run ios:archive-ready` (or `bash scripts/archive-ready.sh`).
  4. Open Xcode, select target, bump build, Archive.
  5. Verify the build label on the auth screen before signing in.

## Verification

- Run `npm run ios:archive-ready` in the cloud sandbox and confirm it completes with `SAFE TO ARCHIVE`.
- Inspect the generated `ios/App/App/public/index.html` for the Google control marker.
- Confirm the auth screen renders both Apple and Google buttons in a mobile viewport preview.

## Out of scope

- Changing the Google OAuth provider configuration in Supabase or Google Cloud Console.
- Adding new social providers.
- Modifying the App Store Connect upload steps.
