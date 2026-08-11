# Flea TestFlight Build Guide

This document describes the exact steps to produce a fresh iOS archive for TestFlight. Follow them in order. Do not skip the verification step at the end.

## Prerequisites

- macOS with Xcode installed.
- The project cloned from your GitHub repository.
- `npm` and Node.js available.
- An iOS device or simulator for final verification.

## Build steps

1. **Pull the latest cloud changes**

   ```bash
   git pull
   ```

   If `npm run ios:archive-ready` reports `Missing script: "ios:archive-ready"`, your local `package.json` is behind the cloud repo. Run `git pull` again and confirm `scripts/prepare-ios-archive.mjs` exists.

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Prepare a verified iOS bundle**

   Use either command:

   ```bash
   npm run ios:archive-ready
   ```

   If the npm script is missing, run the standalone wrapper:

   ```bash
   bash scripts/archive-ready.sh
   ```

   The script will:
   - Clean `dist/`.
   - Build the web bundle.
   - Run `npx cap sync ios`.
   - Apply native patches (entitlements, AppDelegate, etc.).
   - Verify the Google sign-in control marker is present in the copied iOS bundle.

   Wait for the message:

   ```text
   SAFE TO ARCHIVE - Flea build <id> - <date>
   ```

   If it fails with an error about the Google control marker, do not archive. The bundle is missing the Google sign-in button.

4. **Open Xcode**

   ```bash
   npx cap open ios
   ```

5. **Archive in Xcode**
   - Select the App target.
   - Choose `Any iOS Device (arm64)` or a connected device.
   - Bump the Build number.
   - Choose **Product > Archive**.
   - Upload to App Store Connect / TestFlight as usual.

## Verify on device

After installing the TestFlight build:

1. Open the app to the auth screen.
2. Look below **Browse as Guest** for the build label, for example:

   ```text
   Build 12345678 - 2026-08-11 10:00:00 UTC
   Google control: present
   ```

3. Confirm both the **Google** and **Apple** buttons appear above **Browse as Guest**.

If the Google button is missing or the label says `Google control: missing`, the TestFlight archive was built from a stale bundle. Repeat the build steps from `git pull`.

## Troubleshooting

### "Missing script: ios:archive-ready"

Your local `package.json` is out of sync. Run:

```bash
git pull
npm install
bash scripts/archive-ready.sh
```

### "The copied iOS bundle does not contain flea-google-auth-control"

The web build did not include the Google sign-in button. Do not archive. Confirm:

- `src/pages/Auth.tsx` still contains `data-native-bundle-marker="flea-google-auth-control"`.
- You ran `git pull` before building.
- No local changes are hiding the Google button.

### Xcode archive fails with Apple Pay or entitlements errors

Run the native repair script and try again:

```bash
npm run ios:repair-spm
npx cap open ios
```

Then re-run `npm run ios:archive-ready` before archiving.
