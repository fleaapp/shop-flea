# Shorter archive command without the Apple ID re-sign-in

## Why the current command makes Xcode ask for your Apple ID

Two of the four steps are redundant and both are the ones that disturb Xcode:

- `npm install` runs the `postinstall` hook (`scripts/fix-apple-sign-in-spm.mjs` and `scripts/patch-native-capacitor-packages.mjs`), which rewrites the Swift packages inside `node_modules`. Xcode sees the local Swift Package Manager checkouts change, re-resolves them, and that re-resolution plus signing re-check is what prompts for the Apple ID again.
- `bash scripts/setup-ios-native.sh` is already run for you: `npm run ios:archive-ready` calls it as its own step (`scripts/prepare-ios-archive.mjs` runs build, `cap sync ios`, then the native setup script, then the safety assertions). Running it separately just touches `project.pbxproj` an extra time before Xcode reopens it.

## The command to use instead

```text
git pull && npm run ios:archive-ready
```

Then in Xcode: bump the Build number and Archive. No Clean Build Folder needed unless the run reports a problem.

## When you do still need the long version

Run `npm install` only when `git pull` changed `package.json` or `package-lock.json` - that is, when a dependency was added or upgraded. If you are unsure, `git pull` prints the changed files; look for those two.

Run `bash scripts/setup-ios-native.sh` on its own only when you are recovering a wiped or corrupted `ios/` folder as described in `README-IOS.md`.

## What I will change in the repo

- Add a short "routine rebuild vs full rebuild" section to `README-IOS.md` and `TESTFLIGHT.md` documenting the two-command routine path, so this does not get re-introduced.
- No changes to the scripts themselves, no native or app behaviour changes.
