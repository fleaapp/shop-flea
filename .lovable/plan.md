# Fix duplicate `applicationDidBecomeActive` in AppDelegate

## What went wrong

`scripts/setup-ios-native.sh` appends a block containing `applicationDidBecomeActive` into `ios/App/App/AppDelegate.swift`. Capacitor's stock AppDelegate already declares `applicationDidBecomeActive`, so the file now has two, which Xcode rejects:

- line 28: existing Capacitor `applicationDidBecomeActive`
- line 61: the one the script added (invalid redeclaration)
- line 68: the added code uses `UIApplication.shared.windows`, deprecated since iOS 15

The script's "already patched" guard only checks for `clearWebViewBackgrounds`, so it never noticed the clash.

## Fix

### 1. Stop the script from adding a second `applicationDidBecomeActive`

Rewrite the patch logic in `scripts/setup-ios-native.sh`:

- Insert only `clearWebViewBackgrounds()` and `clearBackgroundsRecursively(view:)` as private helpers, plus the two APNs delegate methods.
- Detect whether `applicationDidBecomeActive` already exists in the file:
  - If it exists, insert `DispatchQueue.main.async { self.clearWebViewBackgrounds() }` inside that existing method body rather than declaring a new one.
  - If it does not exist, add the method as today.
- Make the idempotency guard check for each piece separately so re-runs never duplicate.

### 2. Replace the deprecated `windows` API

Use the scene-based lookup instead:

```text
UIApplication.shared.connectedScenes
  -> compactMap as UIWindowScene
  -> flatMap windows
  -> first where isKeyWindow (fallback: first)
```

This clears the iOS 15 deprecation warning and works on all supported iOS versions.

### 3. Repair the already-broken local file

The script must be able to heal a file that already has the duplicate. Before patching, strip any previously injected block (the `clearWebViewBackgrounds` helpers and any script-added `applicationDidBecomeActive`) using a precise marker comment, then re-insert cleanly. Wrap the injected code in `// FLEA-NATIVE-PATCH BEGIN/END` markers so future runs can remove and re-apply it reliably.

## What you run afterwards

```text
git pull
npm install
bash scripts/setup-ios-native.sh
npx cap sync ios
npm run ios:archive-ready
Xcode: Clean Build Folder, then Archive
```

## Verification

- `AppDelegate.swift` contains exactly one `applicationDidBecomeActive`.
- No `UIApplication.shared.windows` reference remains.
- Running `bash scripts/setup-ios-native.sh` twice in a row produces an identical file.
