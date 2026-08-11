# iOS TestFlight archive process

Answer the user's immediate question: yes, clean first, then archive — but the `ios:archive-ready` script already performs a clean production build, so the Xcode Clean step is mainly to clear stale DerivedData and simulator artifacts.

## Recommended sequence

```text
1. git pull origin main
2. npm install
3. npm run ios:archive-ready      (or: bash scripts/archive-ready.sh if package.json is stale)
4. Product → Clean Build Folder   (Cmd+Shift+K)
5. Product → Archive              (Cmd+Shift+A)
6. Distribute app via TestFlight
```

## What `ios:archive-ready` does

- Runs `npm run build` to generate a fresh `dist/` bundle.
- Fails the pipeline if Vite emits circular-chunk warnings (the cause of the recent lime screen).
- Asserts that the Google auth control marker (`data-native-bundle-marker="flea-google-auth-control"`) exists in the built assets.
- Runs `npx cap sync ios` so the native iOS project copies the fresh web bundle.
- Opens Xcode when everything passes.

## Why Clean Build Folder matters

DerivedData can hold an old web bundle or stale native binaries. Cleaning before Archive guarantees the archive contains exactly what `npx cap sync ios` just wrote into `ios/App/App/public`.

## Verification on device

After the new build launches, the native build label below "Browse as Guest" should show:
- Build date matching today.
- `Google control: present`.

If either is missing, do not archive — the bundle is stale.
